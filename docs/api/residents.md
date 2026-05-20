# Residents API

## Purpose

Document resident CRUD, onboarding, filtering, and self-access boundaries.

## Endpoints

| Method | Path | Auth |
| --- | --- | --- |
| `GET` | `/api/residents` | Admin/staff |
| `POST` | `/api/residents` | Admin/staff |
| `GET` | `/api/residents/{id}` | Admin/staff or resident owner |
| `PATCH` | `/api/residents/{id}` | Admin/staff |
| `DELETE` | `/api/residents/{id}` | Admin/staff |

## Query Parameters

| Name | Type | Description |
| --- | --- | --- |
| `organizationId` | `uuid` | Required tenant boundary |
| `hostelId` | `uuid` | Optional hostel filter |
| `status` | `resident_status_enum` | Optional resident status |
| `search` | `string` | Name, phone, admission search |
| `page` | `number` | 1-based page |
| `pageSize` | `number` | Max 100 |

## Security Notes

- Frontend must never send trusted role claims.
- Services verify organization access before repository calls.
- Resident self-updates are limited to safe profile fields in future endpoints.

## TODO

- Add resident invitation API.
- Add Aadhaar/document verification workflow.
- Add bulk import contract.
