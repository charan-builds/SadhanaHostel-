export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Sadhana Boys Hostel Platform API",
    version: "1.0.0",
    description:
      "Versioned API contract for the production Hostel ERP and Resident Management platform.",
  },
  servers: [
    {
      url: "/api/v1",
      description: "Current API version",
    },
  ],
  security: [
    {
      supabaseSession: [],
    },
  ],
  components: {
    securitySchemes: {
      supabaseSession: {
        type: "apiKey",
        in: "cookie",
        name: "sb-access-token",
      },
    },
    schemas: {
      ApiError: {
        type: "object",
        properties: {
          success: { const: false },
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              requestId: { type: "string" },
            },
            required: ["code", "message", "requestId"],
          },
        },
        required: ["success", "error"],
      },
      ApiSuccess: {
        type: "object",
        properties: {
          success: { const: true },
          data: { type: "object" },
          message: { type: "string" },
        },
        required: ["success", "data", "message"],
      },
    },
  },
  paths: {
    "/analytics/dashboard": {
      get: {
        tags: ["Analytics"],
        summary: "Load admin dashboard metrics",
        parameters: [
          {
            name: "organizationId",
            in: "query",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "hostelId",
            in: "query",
            required: false,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": { description: "Dashboard analytics response" },
          "401": { description: "Authentication required" },
          "403": { description: "Forbidden" },
        },
      },
    },
    "/invoices/generate": {
      post: {
        tags: ["Invoices"],
        summary: "Generate a monthly fee invoice PDF",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["organizationId", "monthlyFeeRecordId"],
                properties: {
                  organizationId: { type: "string", format: "uuid" },
                  monthlyFeeRecordId: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Invoice generated" },
          "409": { description: "Invoice conflict" },
        },
      },
    },
    "/invoices/{id}/download": {
      get: {
        tags: ["Invoices"],
        summary: "Create a signed invoice PDF download URL",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "organizationId",
            in: "query",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": { description: "Signed download URL" },
          "404": { description: "Invoice not found" },
        },
      },
    },
    "/jobs/run": {
      post: {
        tags: ["Jobs"],
        summary: "Run a registered background job",
        responses: {
          "200": { description: "Job execution result" },
        },
      },
    },
  },
} as const
