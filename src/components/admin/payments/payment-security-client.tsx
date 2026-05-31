"use client"

import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Loader2,
  QrCode,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react"
import * as Sentry from "@sentry/nextjs"
import type { ChangeEvent, ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { APIErrorState, EmptyState } from "@/components/system"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  useAuditLogs,
  usePaymentQrUpload,
  usePaymentSettings,
  usePaymentSettingsHistory,
  useSavePaymentSettings,
  useTestPaymentSettings,
} from "@/hooks"
import { FrontendApiError } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import { useRealtimePayments } from "@/lib/realtime"
import type {
  PaymentSettingTestResult,
  PaymentSettingView,
} from "@/types/payment-operations"
import type { PaymentSettingsInput } from "@/validations/payment.validation"

const DEFAULT_UTR_REGEX = "^[A-Z0-9][A-Z0-9._/-]{5,63}$"
const DEFAULT_INSTRUCTIONS =
  "Scan the QR code using any UPI app, pay the exact due amount, then submit the UPI reference and screenshot for verification."

type PaymentSecurityForm = {
  accountName: string
  upiId: string
  bankName: string
  branchName: string
  accountLast4: string
  instructions: string
  qrImagePath: string
  isActive: boolean
  supportsManualVerification: boolean
  requireUtr: boolean
  requireScreenshot: boolean
  allowPartialPayment: boolean
  allowAdvancePayment: boolean
  autoExpirePendingPayments: boolean
  minPaymentAmount: string
  utrRegex: string
  duplicateDetectionStrictness: "standard" | "strict"
}

type QrUploadLifecycleStatus =
  | "idle"
  | "selected"
  | "uploading"
  | "uploaded"
  | "saving"
  | "saved"
  | "failed"

type PaymentSecurityClientProps = {
  organizationId: string | null
  hostelId: string | null
}

export function PaymentSecurityClient({
  organizationId,
  hostelId,
}: PaymentSecurityClientProps) {
  const [qrFile, setQrFile] = useState<File | null>(null)
  const [qrUploadStatus, setQrUploadStatus] =
    useState<QrUploadLifecycleStatus>("idle")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [failedQrPreviewUrl, setFailedQrPreviewUrl] = useState<string | null>(null)
  const [reactivateTarget, setReactivateTarget] = useState<PaymentSettingView | null>(null)
  const [validationResultDraft, setValidationResult] =
    useState<PaymentSettingTestResult | null>(null)
  const [formDraft, setFormDraft] = useState<PaymentSecurityForm>(createDefaultForm(null))
  const [formSourceKey, setFormSourceKey] = useState("new")

  useRealtimePayments({ enabled: Boolean(organizationId) })

  const paymentSettings = usePaymentSettings(
    organizationId && hostelId ? { organizationId, hostelId } : undefined
  )
  const history = usePaymentSettingsHistory(
    organizationId && hostelId
      ? { organizationId, hostelId, pageSize: 25 }
      : undefined
  )
  const auditLogs = useAuditLogs(
    "payments",
    organizationId
      ? {
          organizationId,
          tableName: "payment_settings",
          page: 1,
          pageSize: 10,
        }
      : undefined
  )
  const uploadQr = usePaymentQrUpload({
    onProgress: (progress) => setUploadProgress(progress.percent),
  })
  const saveSettings = useSavePaymentSettings()
  const testSettings = useTestPaymentSettings()

  const activeSetting = paymentSettings.data ?? null
  const activeSettingKey = activeSetting
    ? `${activeSetting.id}:${activeSetting.updated_at}:${activeSetting.qr_version}`
    : "new"
  const qrFilePreviewUrl = useMemo(
    () => (qrFile ? URL.createObjectURL(qrFile) : null),
    [qrFile]
  )
  const qrPreviewFailed =
    Boolean(activeSetting?.qrImageSignedUrl) &&
    failedQrPreviewUrl === activeSetting?.qrImageSignedUrl
  const canPreviewQr = Boolean(qrFilePreviewUrl || activeSetting?.qrImageSignedUrl)

  useEffect(() => {
    return () => {
      if (qrFilePreviewUrl) {
        URL.revokeObjectURL(qrFilePreviewUrl)
      }
    }
  }, [qrFilePreviewUrl])

  const shouldUseLoadedSetting = formSourceKey !== activeSettingKey && !qrFile
  const form = useMemo(
    () => (shouldUseLoadedSetting ? createDefaultForm(activeSetting) : formDraft),
    [activeSetting, formDraft, shouldUseLoadedSetting]
  )
  const validationResult = shouldUseLoadedSetting ? null : validationResultDraft

  const payload = useMemo(
    () =>
      organizationId && hostelId
        ? buildPayload({
            organizationId,
            hostelId,
            existing: activeSetting,
            form,
            qrImagePath: form.qrImagePath,
            rotate: shouldRotate(activeSetting, form, qrFile),
          })
        : null,
    [activeSetting, form, hostelId, organizationId, qrFile]
  )

  if (!organizationId || !hostelId) {
    return (
      <ResponsiveContainer size="wide" className="px-0 sm:px-0">
        <EmptyState
          title="Tenant context resolving"
          message="Sadhana Boys Hostel context is being applied automatically."
        />
      </ResponsiveContainer>
    )
  }

  const scopedOrganizationId = organizationId
  const scopedHostelId = hostelId

  async function runConfigTest() {
    if (!payload) {
      return
    }

    try {
      const result = await testSettings.mutateAsync(payload)
      setValidationResult(result)
      if (result.status === "fail") {
        toast.error("Payment configuration has blocking issues.")
      } else if (result.status === "warning") {
        toast.warning("Payment configuration has warnings.")
      } else {
        toast.success("Payment configuration looks ready.")
      }
    } catch (error) {
      toast.error(error instanceof FrontendApiError ? error.message : "Unable to test payment configuration.")
    }
  }

  async function save() {
    if (!payload) {
      return
    }

    const selectedQrFile = qrFile

    try {
      let nextQrImagePath = payload.qrImagePath

      if (selectedQrFile) {
        setQrUploadStatus("uploading")
        const uploaded = await uploadQr.mutateAsync({
          input: {
            organizationId: scopedOrganizationId,
            hostelId: scopedHostelId,
          },
          file: selectedQrFile,
        })
        setQrUploadStatus("uploaded")
        toast.success("QR image uploaded. Saving payment configuration...")
        nextQrImagePath = uploaded.storagePath
        setFailedQrPreviewUrl(null)
        setFormDraft((current) => ({ ...current, qrImagePath: uploaded.storagePath }))
        setFormSourceKey(activeSettingKey)
      }

      if (selectedQrFile) {
        setQrUploadStatus("saving")
      }
      const saved = await saveSettings.mutateAsync({
        ...payload,
        qrImagePath: nextQrImagePath,
        rotate: shouldRotate(activeSetting, form, selectedQrFile),
        qrReplaced: Boolean(selectedQrFile),
      })

      toast.success(
        saved.version > (activeSetting?.version ?? 0)
          ? "Payment account rotated safely."
          : "Payment security settings saved."
      )
      if (selectedQrFile) {
        setQrFile(null)
        setQrUploadStatus("saved")
      }
      setValidationResult(null)
      await Promise.all([paymentSettings.refetch(), history.refetch(), auditLogs.refetch()])
    } catch (error) {
      if (selectedQrFile) {
        setQrUploadStatus("failed")
      }
      Sentry.captureException(error, {
        tags: {
          feature: "payment-security",
          operation: selectedQrFile ? "qr-upload-save" : "settings-save",
        },
        extra: {
          organizationId: scopedOrganizationId,
          hostelId: scopedHostelId,
          fileName: selectedQrFile?.name,
          fileType: selectedQrFile?.type,
          fileSize: selectedQrFile?.size,
        },
      })
      console.error("[payment-security] QR upload/save failed", {
        organizationId: scopedOrganizationId,
        hostelId: scopedHostelId,
        fileName: selectedQrFile?.name,
        fileType: selectedQrFile?.type,
        fileSize: selectedQrFile?.size,
        error,
      })
      toast.error(error instanceof FrontendApiError ? error.message : "Unable to save payment security settings.")
    }
  }

  async function reactivate(setting: PaymentSettingView) {
    try {
      await saveSettings.mutateAsync(
        settingToPayload(setting, scopedOrganizationId, scopedHostelId)
      )
      toast.success("Payment account reactivated.")
      setReactivateTarget(null)
      await Promise.all([paymentSettings.refetch(), history.refetch(), auditLogs.refetch()])
    } catch (error) {
      toast.error(error instanceof FrontendApiError ? error.message : "Unable to reactivate payment account.")
    }
  }

  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title="Payment Security"
        description="Manage the hostel's manual UPI receiving account, QR rotation, verification rules, and finance audit trail."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void runConfigTest()} disabled={testSettings.isPending}>
              {testSettings.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck className="size-4" aria-hidden="true" />
              )}
              Test
            </Button>
            <Button onClick={() => void save()} disabled={saveSettings.isPending || uploadQr.isPending}>
              {saveSettings.isPending || uploadQr.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              {qrFile ? "Upload & Save" : "Save"}
            </Button>
          </div>
        }
      />

      {paymentSettings.error ? (
        <APIErrorState
          title="Payment configuration failed to load"
          message="Unable to load active payment settings."
          onRetry={() => void paymentSettings.refetch()}
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <StatusPanel
          label="Account"
          value={activeSetting?.account_name ?? "Not configured"}
          status={activeSetting?.is_active ? "Active" : "Ready to configure"}
        />
        <StatusPanel
          label="UPI ID"
          value={activeSetting?.upi_id ?? "QR only"}
          status={activeSetting?.require_utr ? "UTR required" : "UTR optional"}
        />
        <StatusPanel
          label="Version"
          value={`v${activeSetting?.version ?? 0} / QR ${activeSetting?.qr_version ?? 0}`}
          status={activeSetting?.updated_at ? formatDateTime(activeSetting.updated_at) : "Never saved"}
        />
        <StatusPanel
          label="Duplicate Detection"
          value={form.duplicateDetectionStrictness}
          status={form.allowPartialPayment ? "Partial allowed" : "Exact payments"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-6">
          <Panel
            title="Active Payment Account"
            description="This is what residents see before scanning and uploading payment proof."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Account holder name" htmlFor="accountName">
                <Input id="accountName" value={form.accountName} onChange={(event) => updateForm("accountName", event.target.value)} />
              </Field>
              <Field label="UPI ID" htmlFor="upiId">
                <Input id="upiId" value={form.upiId} onChange={(event) => updateForm("upiId", event.target.value)} placeholder="sadhanahostel@ibl" />
              </Field>
              <Field label="Bank name" htmlFor="bankName">
                <Input id="bankName" value={form.bankName} onChange={(event) => updateForm("bankName", event.target.value)} placeholder="HDFC Bank" />
              </Field>
              <Field label="Branch" htmlFor="branchName">
                <Input id="branchName" value={form.branchName} onChange={(event) => updateForm("branchName", event.target.value)} placeholder="Main branch" />
              </Field>
              <Field label="Account last 4 digits" htmlFor="accountLast4">
                <Input id="accountLast4" value={form.accountLast4} maxLength={4} inputMode="numeric" onChange={(event) => updateForm("accountLast4", event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" />
              </Field>
              <Field label="Account status" htmlFor="isActive">
                <ToggleRow
                  id="isActive"
                  label="Active receiving account"
                  checked={form.isActive}
                  onChange={(checked) => updateForm("isActive", checked)}
                />
              </Field>
            </div>
          </Panel>

          <Panel
            title="QR Management"
            description="Replacing the QR increments the QR version and invalidates payment-setting caches."
          >
            <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="flex min-h-52 items-center justify-center rounded-lg border bg-muted/20 p-4">
                {qrFilePreviewUrl ? (
                  // Local object URLs are used only before upload so admins can verify the selected QR.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={qrFilePreviewUrl}
                    src={qrFilePreviewUrl}
                    alt="Selected payment QR preview"
                    className="max-h-44 max-w-44 rounded-md object-contain"
                  />
                ) : activeSetting?.qrImageSignedUrl ? (
                  // Signed URLs are generated server-side and expire quickly.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={activeSetting.qrImageSignedUrl}
                    src={activeSetting.qrImageSignedUrl}
                    alt="Current active payment QR"
                    className="max-h-44 max-w-44 rounded-md object-contain"
                    onError={() => setFailedQrPreviewUrl(activeSetting.qrImageSignedUrl)}
                  />
                ) : activeSetting?.qr_image_path ? (
                  <QrPreviewUnavailable
                    message={activeSetting.qrImagePreviewError}
                    onRetry={() => void paymentSettings.refetch()}
                  />
                ) : (
                  <div className="grid place-items-center gap-2 text-muted-foreground">
                    <QrCode className="size-10" aria-hidden="true" />
                    <span className="text-sm">No QR configured</span>
                  </div>
                )}
              </div>
              <div className="grid content-start gap-4">
                <Field label="Replace QR image" htmlFor="qrFile">
                  <Input
                    id="qrFile"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleQrFileChange}
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canPreviewQr}
                    onClick={() => setPreviewOpen(true)}
                  >
                    <Eye className="size-4" aria-hidden="true" />
                    Preview QR
                  </Button>
                  {qrFile ? (
                    <>
                      <Badge variant="secondary">{qrFile.name}</Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setQrFile(null)
                          setUploadProgress(0)
                          setQrUploadStatus("idle")
                        }}
                      >
                        Remove selected
                      </Button>
                    </>
                  ) : null}
                  {qrUploadStatus !== "idle" ? (
                    <Badge variant={qrUploadStatus === "failed" ? "destructive" : "outline"}>
                      {formatQrUploadStatus(qrUploadStatus)}
                    </Badge>
                  ) : null}
                  {uploadQr.isPending ? (
                    <Badge variant="outline">{uploadProgress}% uploaded</Badge>
                  ) : null}
                </div>
                {qrFile ? (
                  <p className="text-sm text-muted-foreground">
                    This QR is selected locally and is not live for residents yet. Click Upload & Save to publish it and regenerate the signed preview.
                  </p>
                ) : null}
                {qrPreviewFailed ? (
                  <APIErrorState
                    title="QR preview could not load"
                    message="The saved QR exists, but this signed preview link failed or expired. Regenerate the preview and try again."
                    onRetry={() => {
                      setFailedQrPreviewUrl(null)
                      void paymentSettings.refetch()
                    }}
                  />
                ) : null}
                <p className="text-sm text-muted-foreground">
                  Old QR references are retained in payment setting history and audit logs so pending payments remain reviewable after rotation.
                </p>
              </div>
            </div>
          </Panel>

          <Panel title="Payment Instructions" description="Shown directly to residents before they submit UTR and proof.">
            <Field label="Resident payment instructions" htmlFor="instructions">
              <Textarea
                id="instructions"
                value={form.instructions}
                onChange={(event) => updateForm("instructions", event.target.value)}
                className="min-h-32"
              />
            </Field>
          </Panel>

          <Panel
            title="Security & Verification"
            description="Controls payment submission rules used by resident payment flows and finance review."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <ToggleRow id="requireUtr" label="Require UTR/reference" checked={form.requireUtr} onChange={(checked) => updateForm("requireUtr", checked)} />
              <ToggleRow id="requireScreenshot" label="Require screenshot proof" checked={form.requireScreenshot} onChange={(checked) => updateForm("requireScreenshot", checked)} />
              <ToggleRow id="allowPartialPayment" label="Allow partial payment" checked={form.allowPartialPayment} onChange={(checked) => updateForm("allowPartialPayment", checked)} />
              <ToggleRow id="allowAdvancePayment" label="Allow advance payment" checked={form.allowAdvancePayment} onChange={(checked) => updateForm("allowAdvancePayment", checked)} />
              <ToggleRow id="autoExpirePendingPayments" label="Auto-expire pending payments" checked={form.autoExpirePendingPayments} onChange={(checked) => updateForm("autoExpirePendingPayments", checked)} />
              <div className="grid gap-2">
                <Label htmlFor="duplicateDetection">Duplicate detection</Label>
                <Select
                  value={form.duplicateDetectionStrictness}
                  onValueChange={(value) => updateForm("duplicateDetectionStrictness", value as "standard" | "strict")}
                >
                  <SelectTrigger id="duplicateDetection">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strict">Strict</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label="Minimum accepted amount" htmlFor="minPaymentAmount">
                <Input id="minPaymentAmount" type="number" min="1" value={form.minPaymentAmount} onChange={(event) => updateForm("minPaymentAmount", event.target.value)} />
              </Field>
              <Field label="UTR regex" htmlFor="utrRegex">
                <Input id="utrRegex" value={form.utrRegex} onChange={(event) => updateForm("utrRegex", event.target.value)} />
              </Field>
            </div>
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Configuration Test" description="Run before saving payment-account changes.">
            {validationResult ? (
              <div className="grid gap-3">
                <Badge variant={validationResult.status === "fail" ? "destructive" : validationResult.status === "warning" ? "outline" : "secondary"}>
                  {validationResult.status.toUpperCase()}
                </Badge>
                {validationResult.checks.map((check) => (
                  <div key={check.key} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 font-medium">
                      {check.status === "pass" ? (
                        <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
                      ) : (
                        <AlertTriangle className="size-4 text-amber-600" aria-hidden="true" />
                      )}
                      {check.label}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{check.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Not tested yet" message="Run a configuration test before saving account rotations." />
            )}
          </Panel>

          <Panel title="Payment Rotation History" description="Inactive rows are retained for audit and pending-payment review.">
            {history.isLoading ? (
              <LoadingState />
            ) : history.data?.length ? (
              <div className="grid gap-3">
                {history.data.map((setting) => (
                  <div key={setting.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{setting.account_name}</p>
                        <p className="text-sm text-muted-foreground">{setting.upi_id ?? "QR only"}</p>
                      </div>
                      <Badge variant={setting.is_active ? "secondary" : "outline"}>
                        {setting.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      v{setting.version} / QR {setting.qr_version} · {formatDateTime(setting.updated_at)}
                    </p>
                    {!setting.is_active ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setReactivateTarget(setting)}
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                        Reactivate
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No payment accounts" message="Save the first payment account to start rotation history." />
            )}
          </Panel>
        </div>
      </section>

      <Panel title="Audit Logs" description="Finance configuration changes are written to tenant-scoped append-only audit logs.">
        {auditLogs.isLoading ? (
          <LoadingState variant="table" />
        ) : auditLogs.data?.data.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Request</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.data.data.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.action}</TableCell>
                  <TableCell>{log.actor_user_id?.slice(0, 8) ?? "-"}</TableCell>
                  <TableCell>{log.request_id ?? "-"}</TableCell>
                  <TableCell>{formatDateTime(log.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="No audit logs yet" message="Payment configuration changes will appear here after the first save." />
        )}
      </Panel>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Payment QR Preview</DialogTitle>
            <DialogDescription>Short-lived signed preview for the active hostel payment QR.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center rounded-lg border bg-muted/20 p-6">
            {qrFilePreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={qrFilePreviewUrl}
                src={qrFilePreviewUrl}
                alt="Selected payment QR preview"
                className="max-h-72 object-contain"
              />
            ) : activeSetting?.qrImageSignedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={activeSetting.qrImageSignedUrl}
                src={activeSetting.qrImageSignedUrl}
                alt="Payment QR preview"
                className="max-h-72 object-contain"
                onError={() => setFailedQrPreviewUrl(activeSetting.qrImageSignedUrl)}
              />
            ) : activeSetting?.qr_image_path ? (
              <QrPreviewUnavailable
                message={activeSetting.qrImagePreviewError}
                onRetry={() => void paymentSettings.refetch()}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(reactivateTarget)}
        onOpenChange={(open) => !open && setReactivateTarget(null)}
        title="Reactivate old payment account?"
        description="This will make the selected account active and deactivate the current receiving account for new resident payments."
        confirmLabel="Reactivate"
        onConfirm={() => (reactivateTarget ? reactivate(reactivateTarget) : undefined)}
      />
    </ResponsiveContainer>
  )

  function updateForm<TKey extends keyof PaymentSecurityForm>(
    key: TKey,
    value: PaymentSecurityForm[TKey]
  ) {
    setFormDraft({ ...form, [key]: value })
    setFormSourceKey(activeSettingKey)
    setValidationResult(null)
  }

  function handleQrFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0] ?? null
    setFailedQrPreviewUrl(null)
    setUploadProgress(0)

    if (!selectedFile) {
      setQrFile(null)
      setQrUploadStatus("idle")
      return
    }

    const validationError = validateQrFileForClient(selectedFile)
    if (validationError) {
      event.currentTarget.value = ""
      setQrFile(null)
      setQrUploadStatus("failed")
      Sentry.captureMessage("Invalid payment QR file selected", {
        level: "warning",
        tags: {
          feature: "payment-security",
          operation: "qr-file-select",
        },
        extra: {
          organizationId: scopedOrganizationId,
          hostelId: scopedHostelId,
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size,
          validationError,
        },
      })
      toast.error(validationError)
      return
    }

    setQrFile(selectedFile)
    setQrUploadStatus("selected")
    setFormSourceKey(activeSettingKey)
    setValidationResult(null)
    toast.info("QR image selected. Click Upload & Save to publish it.")
  }
}

function Panel({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border bg-background p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
    >
      <span>{label}</span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-slate-950"
      />
    </label>
  )
}

function StatusPanel({
  label,
  value,
  status,
}: {
  label: string
  value: string
  status: string
}) {
  return (
    <div className="rounded-lg border bg-background p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{status}</p>
    </div>
  )
}

function formatQrUploadStatus(status: QrUploadLifecycleStatus) {
  switch (status) {
    case "selected":
      return "Selected, not live"
    case "uploading":
      return "Uploading"
    case "uploaded":
      return "Uploaded"
    case "saving":
      return "Saving"
    case "saved":
      return "Saved"
    case "failed":
      return "Failed"
    case "idle":
    default:
      return "Ready"
  }
}

function QrPreviewUnavailable({
  message,
  onRetry,
}: {
  message?: string | null
  onRetry: () => void
}) {
  return (
    <div className="grid place-items-center gap-3 text-center text-muted-foreground">
      <AlertTriangle className="size-10 text-amber-600" aria-hidden="true" />
      <div className="grid gap-1">
        <p className="text-sm font-medium text-foreground">QR preview unavailable</p>
        <p className="max-w-64 text-xs leading-5">
          {message ??
            "The QR image is saved, but the signed preview link could not be generated."}
        </p>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        Regenerate preview
      </Button>
    </div>
  )
}

function validateQrFileForClient(file: File) {
  if (file.size === 0) {
    return "Choose a non-empty QR image."
  }

  if (file.size > 2 * 1024 * 1024) {
    return "QR image must be 2 MB or smaller."
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "QR image must be a JPEG, PNG, or WebP file."
  }

  return null
}

function createDefaultForm(setting: PaymentSettingView | null): PaymentSecurityForm {
  return {
    accountName: setting?.account_name ?? "Sadhana Boys Hostel",
    upiId: setting?.upi_id ?? "",
    bankName: setting?.bank_name ?? "",
    branchName: setting?.branch_name ?? "",
    accountLast4: setting?.account_last4 ?? "",
    instructions: setting?.instructions ?? DEFAULT_INSTRUCTIONS,
    qrImagePath: setting?.qr_image_path ?? "",
    isActive: setting?.is_active ?? true,
    supportsManualVerification: setting?.supports_manual_verification ?? true,
    requireUtr: setting?.require_utr ?? true,
    requireScreenshot: setting?.require_screenshot ?? true,
    allowPartialPayment: setting?.allow_partial_payment ?? true,
    allowAdvancePayment: setting?.allow_advance_payment ?? true,
    autoExpirePendingPayments: setting?.auto_expire_pending_payments ?? true,
    minPaymentAmount: String(setting?.min_payment_amount ?? 1),
    utrRegex: setting?.utr_regex ?? DEFAULT_UTR_REGEX,
    duplicateDetectionStrictness: setting?.duplicate_detection_strictness ?? "strict",
  }
}

function shouldRotate(
  existing: PaymentSettingView | null,
  form: PaymentSecurityForm,
  qrFile: File | null
) {
  if (!existing) {
    return false
  }

  return Boolean(
    qrFile ||
      existing.upi_id !== (form.upiId || null) ||
      existing.account_name !== form.accountName ||
      existing.bank_name !== (form.bankName || null) ||
      existing.account_last4 !== (form.accountLast4 || null)
  )
}

function buildPayload({
  organizationId,
  hostelId,
  existing,
  form,
  qrImagePath,
  rotate,
}: {
  organizationId: string
  hostelId: string
  existing: PaymentSettingView | null
  form: PaymentSecurityForm
  qrImagePath: string
  rotate: boolean
}): PaymentSettingsInput {
  return {
    id: rotate ? undefined : existing?.id,
    organizationId,
    hostelId,
    paymentMethod: "upi",
    accountName: form.accountName,
    upiId: form.upiId,
    qrImagePath,
    bankName: form.bankName,
    branchName: form.branchName,
    accountLast4: form.accountLast4,
    isActive: form.isActive,
    supportsManualVerification: form.supportsManualVerification,
    instructions: form.instructions,
    requireUtr: form.requireUtr,
    requireScreenshot: form.requireScreenshot,
    allowPartialPayment: form.allowPartialPayment,
    allowAdvancePayment: form.allowAdvancePayment,
    autoExpirePendingPayments: form.autoExpirePendingPayments,
    minPaymentAmount: Number(form.minPaymentAmount || 1),
    utrRegex: form.utrRegex,
    duplicateDetectionStrictness: form.duplicateDetectionStrictness,
    rotate,
    qrReplaced: false,
  }
}

function settingToPayload(
  setting: PaymentSettingView,
  organizationId: string,
  hostelId: string
): PaymentSettingsInput {
  return {
    id: setting.id,
    organizationId,
    hostelId,
    paymentMethod: setting.payment_method,
    accountName: setting.account_name,
    upiId: setting.upi_id ?? "",
    qrImagePath: setting.qr_image_path ?? "",
    bankName: setting.bank_name ?? "",
    branchName: setting.branch_name ?? "",
    accountLast4: setting.account_last4 ?? "",
    isActive: true,
    supportsManualVerification: setting.supports_manual_verification,
    instructions: setting.instructions ?? "",
    requireUtr: setting.require_utr,
    requireScreenshot: setting.require_screenshot,
    allowPartialPayment: setting.allow_partial_payment,
    allowAdvancePayment: setting.allow_advance_payment,
    autoExpirePendingPayments: setting.auto_expire_pending_payments,
    minPaymentAmount: setting.min_payment_amount,
    utrRegex: setting.utr_regex,
    duplicateDetectionStrictness: setting.duplicate_detection_strictness,
    rotate: false,
    qrReplaced: false,
  }
}
