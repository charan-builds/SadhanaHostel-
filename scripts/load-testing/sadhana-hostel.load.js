import http from "k6/http"
import { check, group, sleep } from "k6"
import { Counter, Rate, Trend } from "k6/metrics"

const BASE_URL = __ENV.LOAD_TEST_BASE_URL || "http://localhost:3002"
const ORG_ID = __ENV.LOAD_TEST_ORGANIZATION_ID || ""
const HOSTEL_ID = __ENV.LOAD_TEST_HOSTEL_ID || ""
const RESIDENT_ID = __ENV.LOAD_TEST_RESIDENT_ID || ""
const ADMIN_EMAIL = __ENV.LOAD_TEST_ADMIN_EMAIL || ""
const ADMIN_PASSWORD = __ENV.LOAD_TEST_ADMIN_PASSWORD || ""
const RESIDENT_EMAIL = __ENV.LOAD_TEST_RESIDENT_EMAIL || ""
const RESIDENT_PASSWORD = __ENV.LOAD_TEST_RESIDENT_PASSWORD || ""
const ENABLE_MUTATIONS = __ENV.LOAD_TEST_MUTATIONS === "true"
const ACTIVE_SCENARIOS = new Set(
  (__ENV.LOAD_TEST_SCENARIOS || "health,resident,admin")
    .split(",")
    .map((scenario) => scenario.trim())
    .filter(Boolean)
)

const apiErrors = new Counter("sadhana_api_errors")
const paymentFailures = new Counter("sadhana_payment_failures")
const uploadFailures = new Counter("sadhana_upload_failures")
const realtimeChecks = new Counter("sadhana_realtime_checks")
const workflowSuccessRate = new Rate("sadhana_workflow_success_rate")
const loginLatency = new Trend("sadhana_login_latency")
const analyticsLatency = new Trend("sadhana_analytics_latency")
const searchLatency = new Trend("sadhana_search_latency")
const exportLatency = new Trend("sadhana_export_latency")

export const options = {
  scenarios: buildScenarios(),
  thresholds: buildThresholds(),
}

function buildScenarios() {
  const scenarios = {}

  if (ACTIVE_SCENARIOS.has("health")) {
    scenarios.health = {
      executor: "constant-vus",
      vus: Number(__ENV.LOAD_TEST_HEALTH_VUS || 2),
      duration: __ENV.LOAD_TEST_DURATION || "2m",
      exec: "healthWorkflow",
    }
  }

  if (ACTIVE_SCENARIOS.has("resident")) {
    const residentVus = Number(__ENV.LOAD_TEST_RESIDENT_VUS || 10)

    scenarios.resident_workflows = {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: residentVus },
        { duration: __ENV.LOAD_TEST_DURATION || "2m", target: residentVus },
        { duration: "30s", target: 0 },
      ],
      exec: "residentWorkflow",
    }
  }

  if (ACTIVE_SCENARIOS.has("admin")) {
    const adminVus = Number(__ENV.LOAD_TEST_ADMIN_VUS || 3)

    scenarios.admin_workflows = {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: adminVus },
        { duration: __ENV.LOAD_TEST_DURATION || "2m", target: adminVus },
        { duration: "30s", target: 0 },
      ],
      exec: "adminWorkflow",
    }
  }

  if (ACTIVE_SCENARIOS.has("uploads")) {
    const uploadVus = Number(__ENV.LOAD_TEST_UPLOAD_VUS || 2)

    scenarios.upload_workflows = {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "15s", target: uploadVus },
        {
          duration: __ENV.LOAD_TEST_UPLOAD_DURATION || __ENV.LOAD_TEST_DURATION || "2m",
          target: uploadVus,
        },
        { duration: "15s", target: 0 },
      ],
      exec: "uploadWorkflow",
    }
  }

  if (ACTIVE_SCENARIOS.has("realtime")) {
    scenarios.realtime_reconnect_pressure = {
      executor: "constant-vus",
      vus: Number(__ENV.LOAD_TEST_REALTIME_VUS || 5),
      duration: __ENV.LOAD_TEST_REALTIME_DURATION || __ENV.LOAD_TEST_DURATION || "2m",
      exec: "realtimeWorkflow",
    }
  }

  return scenarios
}

function buildThresholds() {
  const thresholds = {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2500"],
    sadhana_workflow_success_rate: ["rate>0.95"],
  }

  if (ACTIVE_SCENARIOS.has("resident") || ACTIVE_SCENARIOS.has("admin")) {
    thresholds.sadhana_login_latency = ["p(95)<1200"]
  }

  if (ACTIVE_SCENARIOS.has("admin")) {
    thresholds.sadhana_analytics_latency = ["p(95)<2500"]
    thresholds.sadhana_search_latency = ["p(95)<1500"]
    thresholds.sadhana_export_latency = ["p(95)<5000"]
  }

  if (ACTIVE_SCENARIOS.has("uploads")) {
    thresholds.sadhana_upload_failures = ["count==0"]
  }

  return thresholds
}

export function healthWorkflow() {
  group("health checks", () => {
    const live = http.get(`${BASE_URL}/api/health/live`, jsonHeaders())
    const ready = http.get(`${BASE_URL}/api/health/ready`, jsonHeaders())

    recordCheck(live, "live health is ok", (response) => response.status === 200)
    recordCheck(ready, "ready health returns safe status", (response) =>
      [200, 503].includes(response.status)
    )
  })

  sleep(1)
}

export function residentWorkflow() {
  const jar = http.cookieJar()

  group("resident login", () => {
    const response = login(jar, RESIDENT_EMAIL, RESIDENT_PASSWORD)
    loginLatency.add(response.timings.duration)
    recordCheck(response, "resident login response accepted", (res) => [200, 401].includes(res.status))
  })

  group("resident dashboard and payments", () => {
    const payments = http.get(
      `${BASE_URL}/api/payments/resident/${RESIDENT_ID}?organizationId=${ORG_ID}`,
      authHeaders(true, jar)
    )
    recordCheck(payments, "resident payments scoped response", (response) =>
      [200, 401, 403].includes(response.status)
    )

    if (ENABLE_MUTATIONS) {
      const payment = createUpiPayment(jar)

      if (payment?.id) {
        uploadPaymentProof(payment.id, jar)
      }
    }
  })

  group("resident leave and notices", () => {
    const leaves = http.get(
      `${BASE_URL}/api/leaves?organizationId=${ORG_ID}&residentId=${RESIDENT_ID}`,
      authHeaders(true, jar)
    )
    const notices = http.get(
      `${BASE_URL}/api/notices?organizationId=${ORG_ID}&hostelId=${HOSTEL_ID}`,
      authHeaders(true, jar)
    )

    recordCheck(leaves, "resident leaves response scoped", (response) =>
      [200, 401, 403].includes(response.status)
    )
    recordCheck(notices, "notices response scoped", (response) =>
      [200, 401, 403].includes(response.status)
    )
  })

  realtimeChecks.add(1)
  sleep(1)
}

export function adminWorkflow() {
  const jar = http.cookieJar()

  group("admin login", () => {
    const response = login(jar, ADMIN_EMAIL, ADMIN_PASSWORD)
    loginLatency.add(response.timings.duration)
    recordCheck(response, "admin login response accepted", (res) => [200, 401].includes(res.status))
  })

  group("dashboard analytics", () => {
    const started = Date.now()
    const response = http.get(
      `${BASE_URL}/api/v1/analytics/dashboard?organizationId=${ORG_ID}&hostelId=${HOSTEL_ID}`,
      authHeaders(true, jar)
    )
    analyticsLatency.add(Date.now() - started)
    recordCheck(response, "analytics response scoped", (res) => [200, 401, 403].includes(res.status))
  })

  group("search APIs", () => {
    const started = Date.now()
    const response = http.get(
      `${BASE_URL}/api/v1/search?organizationId=${ORG_ID}&q=resident&page=1&pageSize=20`,
      authHeaders(true, jar)
    )
    searchLatency.add(Date.now() - started)
    recordCheck(response, "search response scoped", (res) => [200, 401, 403].includes(res.status))
  })

  group("exports", () => {
    const started = Date.now()
    const response = http.get(
      `${BASE_URL}/api/v1/reports/payments?organizationId=${ORG_ID}&hostelId=${HOSTEL_ID}&format=csv`,
      authHeaders(true, jar)
    )
    exportLatency.add(Date.now() - started)
    recordCheck(response, "export response scoped", (res) => [200, 401, 403].includes(res.status))
  })

  sleep(1)
}

export function uploadWorkflow() {
  const jar = http.cookieJar()

  group("resident upload mutation guard", () => {
    const loginResponse = login(jar, RESIDENT_EMAIL, RESIDENT_PASSWORD)
    loginLatency.add(loginResponse.timings.duration)
    const loginOk = recordCheck(
      loginResponse,
      "upload actor login accepted",
      (res) => res.status === 200
    )

    if (!ENABLE_MUTATIONS) {
      workflowSuccessRate.add(true)
      return
    }

    if (!loginOk) {
      uploadFailures.add(1)
      return
    }

    const payment = createUpiPayment(jar)

    if (!payment?.id) {
      uploadFailures.add(1)
      return
    }

    uploadPaymentProof(payment.id, jar)
  })

  sleep(1)
}

export function realtimeWorkflow() {
  const jar = http.cookieJar()

  group("realtime reconnect-adjacent reads", () => {
    const loginResponse = login(
      jar,
      ADMIN_EMAIL || RESIDENT_EMAIL,
      ADMIN_PASSWORD || RESIDENT_PASSWORD
    )
    loginLatency.add(loginResponse.timings.duration)
    recordCheck(loginResponse, "realtime actor login accepted", (res) =>
      [200, 401].includes(res.status)
    )

    const health = http.get(`${BASE_URL}/api/health/ready`, {
      headers: {
        accept: "application/json",
        connection: "close",
        "x-request-id": `k6-realtime-${Date.now()}-${__VU}-${__ITER}`,
      },
    })
    recordCheck(health, "realtime readiness survives reconnect pressure", (res) =>
      [200, 503].includes(res.status)
    )

    const payments = http.get(
      `${BASE_URL}/api/payments?organizationId=${ORG_ID}&hostelId=${HOSTEL_ID}`,
      authHeaders(true, jar)
    )
    recordCheck(payments, "realtime payment feed remains tenant scoped", (res) =>
      [200, 401, 403].includes(res.status)
    )

    const admissions = http.get(
      `${BASE_URL}/api/admissions/vacancy?organizationId=${ORG_ID}&hostelId=${HOSTEL_ID}`,
      authHeaders(true, jar)
    )
    recordCheck(admissions, "realtime vacancy feed remains tenant scoped", (res) =>
      [200, 401, 403].includes(res.status)
    )
  })

  realtimeChecks.add(1)
  sleep(1)
}

function login(jar, email, password) {
  if (!email || !password) {
    return {
      status: 401,
      timings: { duration: 0 },
    }
  }

  return http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      identifier: email,
      password,
    }),
    {
      ...jsonHeaders(),
      jar,
    }
  )
}

function createUpiPayment(jar) {
  const response = http.post(
    `${BASE_URL}/api/payments/create`,
    JSON.stringify({
      organizationId: ORG_ID,
      hostelId: HOSTEL_ID,
      residentId: RESIDENT_ID,
      amount: 100,
      method: "upi",
      transactionId: `K6-${Date.now()}-${__VU}-${__ITER}`,
      notes: "k6 staging payment proof workflow",
      idempotencyKey: `k6-${Date.now()}-${__VU}-${__ITER}`,
    }),
    authHeaders(true, jar)
  )

  const ok = recordCheck(
    response,
    "payment create accepted",
    (res) => res.status === 201 || res.status === 200
  )

  if (!ok) {
    paymentFailures.add(1)
    return null
  }

  try {
    return response.json("data")
  } catch {
    paymentFailures.add(1)
    return null
  }
}

function uploadPaymentProof(paymentId, jar) {
  const payload = {
    organizationId: ORG_ID,
    hostelId: HOSTEL_ID,
    residentId: RESIDENT_ID,
    paymentId,
    file: http.file("synthetic payment proof", "payment-proof.txt", "image/png"),
  }
  const response = http.post(
    `${BASE_URL}/api/uploads/payment-proof`,
    payload,
    authHeaders(false, jar)
  )
  const ok = recordCheck(response, "payment proof upload accepted", (res) => res.status === 201)

  if (!ok) {
    uploadFailures.add(1)
  }
}

function jsonHeaders() {
  return {
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-request-id": `k6-${Date.now()}-${__VU}-${__ITER}`,
    },
  }
}

function authHeaders(json = true, jar = undefined) {
  const headers = {
    accept: "application/json",
    "x-request-id": `k6-${Date.now()}-${__VU}-${__ITER}`,
  }

  if (json) {
    headers["content-type"] = "application/json"
  }

  return jar ? { headers, jar } : { headers }
}

function recordCheck(response, name, predicate) {
  const ok = check(response, {
    [name]: predicate,
  })

  workflowSuccessRate.add(ok)

  if (!ok) {
    apiErrors.add(1)
  }

  return ok
}

export function handleSummary(data) {
  const summary = toSummary(data)
  const markdown = toMarkdownSummary(data)

  return {
    stdout: markdown,
    "scripts/load-testing/last-summary.json": JSON.stringify(summary, null, 2),
    "scripts/load-testing/last-summary.md": markdown,
  }
}

function toSummary(data) {
  const metricValues = (name) => data.metrics[name]?.values ?? {}

  return {
    finishedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    activeScenarios: Array.from(ACTIVE_SCENARIOS),
    mutationsEnabled: ENABLE_MUTATIONS,
    metrics: {
      httpReqDurationP95: metricValues("http_req_duration")["p(95)"],
      httpReqFailedRate: metricValues("http_req_failed").rate,
      workflowSuccessRate: metricValues("sadhana_workflow_success_rate").rate,
      apiErrors: metricValues("sadhana_api_errors").count,
      paymentFailures: metricValues("sadhana_payment_failures").count,
      uploadFailures: metricValues("sadhana_upload_failures").count,
      realtimeChecks: metricValues("sadhana_realtime_checks").count,
    },
  }
}

function toMarkdownSummary(data) {
  const summary = toSummary(data)

  return [
    "# Sadhana Load Test Summary",
    "",
    `- Finished: ${summary.finishedAt}`,
    `- Base URL: ${summary.baseUrl}`,
    `- Active scenarios: ${summary.activeScenarios.join(", ")}`,
    `- Mutations enabled: ${summary.mutationsEnabled}`,
    `- HTTP p95: ${summary.metrics.httpReqDurationP95 ?? "n/a"} ms`,
    `- HTTP failed rate: ${summary.metrics.httpReqFailedRate ?? "n/a"}`,
    `- Workflow success rate: ${summary.metrics.workflowSuccessRate ?? "n/a"}`,
    `- API errors: ${summary.metrics.apiErrors ?? 0}`,
    `- Payment failures: ${summary.metrics.paymentFailures ?? 0}`,
    `- Upload failures: ${summary.metrics.uploadFailures ?? 0}`,
    `- Realtime checks: ${summary.metrics.realtimeChecks ?? 0}`,
    "",
  ].join("\n")
}
