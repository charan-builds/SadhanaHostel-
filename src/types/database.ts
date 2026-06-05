export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          created_by: string | null
          hostel_id: string | null
          id: string
          ip_address: unknown
          metadata: Json
          new_values: Json | null
          old_values: Json | null
          organization_id: string | null
          record_id: string | null
          request_id: string | null
          table_name: string
          updated_at: string
          updated_by: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          created_by?: string | null
          hostel_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          record_id?: string | null
          request_id?: string | null
          table_name: string
          updated_at?: string
          updated_by?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          created_by?: string | null
          hostel_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          record_id?: string | null
          request_id?: string | null
          table_name?: string
          updated_at?: string
          updated_by?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          bucket_name: string
          checksum: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          document_type: Database["public"]["Enums"]["document_type_enum"]
          file_name: string
          file_size_bytes: number
          hostel_id: string | null
          id: string
          invoice_id: string | null
          is_active: boolean
          is_public: boolean
          metadata: Json
          mime_type: string
          organization_id: string
          payment_id: string | null
          rejection_reason: string | null
          resident_id: string | null
          status: Database["public"]["Enums"]["document_status_enum"]
          storage_path: string
          updated_at: string
          updated_by: string | null
          uploaded_by_user_id: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          bucket_name: string
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          document_type: Database["public"]["Enums"]["document_type_enum"]
          file_name: string
          file_size_bytes: number
          hostel_id?: string | null
          id?: string
          invoice_id?: string | null
          is_active?: boolean
          is_public?: boolean
          metadata?: Json
          mime_type: string
          organization_id: string
          payment_id?: string | null
          rejection_reason?: string | null
          resident_id?: string | null
          status?: Database["public"]["Enums"]["document_status_enum"]
          storage_path: string
          updated_at?: string
          updated_by?: string | null
          uploaded_by_user_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          bucket_name?: string
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          document_type?: Database["public"]["Enums"]["document_type_enum"]
          file_name?: string
          file_size_bytes?: number
          hostel_id?: string | null
          id?: string
          invoice_id?: string | null
          is_active?: boolean
          is_public?: boolean
          metadata?: Json
          mime_type?: string
          organization_id?: string
          payment_id?: string | null
          rejection_reason?: string | null
          resident_id?: string | null
          status?: Database["public"]["Enums"]["document_status_enum"]
          storage_path?: string
          updated_at?: string
          updated_by?: string | null
          uploaded_by_user_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          hostel_id: string | null
          icon_name: string | null
          id: string
          image_document_id: string | null
          is_active: boolean
          is_highlighted: boolean
          name: string
          organization_id: string
          published_at: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["cms_status_enum"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          hostel_id?: string | null
          icon_name?: string | null
          id?: string
          image_document_id?: string | null
          is_active?: boolean
          is_highlighted?: boolean
          name: string
          organization_id: string
          published_at?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["cms_status_enum"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          hostel_id?: string | null
          icon_name?: string | null
          id?: string
          image_document_id?: string | null
          is_active?: boolean
          is_highlighted?: boolean
          name?: string
          organization_id?: string
          published_at?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["cms_status_enum"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facilities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_image_document_id_fkey"
            columns: ["image_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery: {
        Row: {
          alt_text: string | null
          category: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          document_id: string
          hostel_id: string | null
          id: string
          is_active: boolean
          organization_id: string
          published_at: string | null
          sort_order: number
          status: Database["public"]["Enums"]["cms_status_enum"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alt_text?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          document_id: string
          hostel_id?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          published_at?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["cms_status_enum"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alt_text?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          document_id?: string
          hostel_id?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          published_at?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["cms_status_enum"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hostels: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          capacity: number
          city: string | null
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          phone: string | null
          postal_code: string | null
          settings: Json
          slug: string
          state: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          capacity?: number
          city?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          phone?: string | null
          postal_code?: string | null
          settings?: Json
          slug: string
          state?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          capacity?: number
          city?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          phone?: string | null
          postal_code?: string | null
          settings?: Json
          slug?: string
          state?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hostels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostels_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostels_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance_amount: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          discount_amount: number
          due_date: string | null
          hostel_id: string
          id: string
          invoice_number: string
          is_active: boolean
          issue_date: string
          metadata: Json
          monthly_fee_record_id: string | null
          organization_id: string
          paid_amount: number
          pdf_document_id: string | null
          pdf_storage_path: string | null
          resident_id: string
          status: Database["public"]["Enums"]["invoice_status_enum"]
          subtotal_amount: number
          tax_amount: number
          total_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          balance_amount?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          discount_amount?: number
          due_date?: string | null
          hostel_id: string
          id?: string
          invoice_number: string
          is_active?: boolean
          issue_date?: string
          metadata?: Json
          monthly_fee_record_id?: string | null
          organization_id: string
          paid_amount?: number
          pdf_document_id?: string | null
          pdf_storage_path?: string | null
          resident_id: string
          status?: Database["public"]["Enums"]["invoice_status_enum"]
          subtotal_amount?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          balance_amount?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          discount_amount?: number
          due_date?: string | null
          hostel_id?: string
          id?: string
          invoice_number?: string
          is_active?: boolean
          issue_date?: string
          metadata?: Json
          monthly_fee_record_id?: string | null
          organization_id?: string
          paid_amount?: number
          pdf_document_id?: string | null
          pdf_storage_path?: string | null
          resident_id?: string
          status?: Database["public"]["Enums"]["invoice_status_enum"]
          subtotal_amount?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_monthly_fee_record_id_fkey"
            columns: ["monthly_fee_record_id"]
            isOneToOne: false
            referencedRelation: "monthly_fee_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_pdf_document_fkey"
            columns: ["pdf_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          departed_at: string | null
          destination: string | null
          from_date: string
          hostel_id: string
          id: string
          is_active: boolean
          metadata: Json
          notes: string | null
          organization_id: string
          parent_notified_at: string | null
          reason: string
          rejection_reason: string | null
          resident_id: string
          returned_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["leave_status_enum"]
          to_date: string
          travel_mode: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          departed_at?: string | null
          destination?: string | null
          from_date: string
          hostel_id: string
          id?: string
          is_active?: boolean
          metadata?: Json
          notes?: string | null
          organization_id: string
          parent_notified_at?: string | null
          reason: string
          rejection_reason?: string | null
          resident_id: string
          returned_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["leave_status_enum"]
          to_date: string
          travel_mode?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          departed_at?: string | null
          destination?: string | null
          from_date?: string
          hostel_id?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          notes?: string | null
          organization_id?: string
          parent_notified_at?: string | null
          reason?: string
          rejection_reason?: string | null
          resident_id?: string
          returned_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["leave_status_enum"]
          to_date?: string
          travel_mode?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_fee_records: {
        Row: {
          adjustment_amount: number
          advance_adjustment_amount: number
          balance_amount: number
          base_amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          discount_amount: number
          due_date: string
          generated_at: string
          hostel_id: string
          id: string
          is_active: boolean
          metadata: Json
          notes: string | null
          organization_id: string
          paid_amount: number
          penalty_amount: number
          period_month: string
          resident_id: string
          room_allocation_id: string | null
          status: Database["public"]["Enums"]["fee_record_status_enum"]
          total_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adjustment_amount?: number
          advance_adjustment_amount?: number
          balance_amount?: number
          base_amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          discount_amount?: number
          due_date: string
          generated_at?: string
          hostel_id: string
          id?: string
          is_active?: boolean
          metadata?: Json
          notes?: string | null
          organization_id: string
          paid_amount?: number
          penalty_amount?: number
          period_month: string
          resident_id: string
          room_allocation_id?: string | null
          status?: Database["public"]["Enums"]["fee_record_status_enum"]
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adjustment_amount?: number
          advance_adjustment_amount?: number
          balance_amount?: number
          base_amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          discount_amount?: number
          due_date?: string
          generated_at?: string
          hostel_id?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          notes?: string | null
          organization_id?: string
          paid_amount?: number
          penalty_amount?: number
          period_month?: string
          resident_id?: string
          room_allocation_id?: string | null
          status?: Database["public"]["Enums"]["fee_record_status_enum"]
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_fee_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_fee_records_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_fee_records_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_fee_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_fee_records_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_fee_records_room_allocation_id_fkey"
            columns: ["room_allocation_id"]
            isOneToOne: false
            referencedRelation: "room_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_fee_records_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          audience_filter: Json
          audience_type: string
          body: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          expires_at: string | null
          hostel_id: string | null
          id: string
          is_active: boolean
          is_pinned: boolean
          organization_id: string
          published_at: string | null
          published_by: string | null
          status: Database["public"]["Enums"]["cms_status_enum"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audience_filter?: Json
          audience_type?: string
          body: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          expires_at?: string | null
          hostel_id?: string | null
          id?: string
          is_active?: boolean
          is_pinned?: boolean
          organization_id: string
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["cms_status_enum"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audience_filter?: Json
          audience_type?: string
          body?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          expires_at?: string | null
          hostel_id?: string | null
          id?: string
          is_active?: boolean
          is_pinned?: boolean
          organization_id?: string
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["cms_status_enum"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notices_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notices_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notices_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notices_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          attempt_number: number
          channel: Database["public"]["Enums"]["notification_channel_enum"]
          created_at: string
          created_by: string | null
          delivered_at: string | null
          error_message: string | null
          hostel_id: string | null
          id: string
          notification_id: string
          organization_id: string
          provider: string | null
          provider_message_id: string | null
          request_payload: Json | null
          response_payload: Json | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status_enum"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attempt_number?: number
          channel: Database["public"]["Enums"]["notification_channel_enum"]
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          error_message?: string | null
          hostel_id?: string | null
          id?: string
          notification_id: string
          organization_id: string
          provider?: string | null
          provider_message_id?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          sent_at?: string | null
          status: Database["public"]["Enums"]["notification_status_enum"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attempt_number?: number
          channel?: Database["public"]["Enums"]["notification_channel_enum"]
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          error_message?: string | null
          hostel_id?: string | null
          id?: string
          notification_id?: string
          organization_id?: string
          provider?: string | null
          provider_message_id?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status_enum"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel_enum"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          delivered_at: string | null
          failure_reason: string | null
          hostel_id: string | null
          id: string
          is_active: boolean
          notice_id: string | null
          organization_id: string
          payload: Json
          read_at: string | null
          recipient_user_id: string | null
          resident_id: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status_enum"]
          template_key: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          channel?: Database["public"]["Enums"]["notification_channel_enum"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          delivered_at?: string | null
          failure_reason?: string | null
          hostel_id?: string | null
          id?: string
          is_active?: boolean
          notice_id?: string | null
          organization_id: string
          payload?: Json
          read_at?: string | null
          recipient_user_id?: string | null
          resident_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status_enum"]
          template_key?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel_enum"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          delivered_at?: string | null
          failure_reason?: string | null
          hostel_id?: string | null
          id?: string
          is_active?: boolean
          notice_id?: string | null
          organization_id?: string
          payload?: Json
          read_at?: string | null
          recipient_user_id?: string | null
          resident_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status_enum"]
          template_key?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          billing_email: string | null
          city: string | null
          contact_phone: string | null
          country: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_active: boolean
          legal_name: string | null
          name: string
          postal_code: string | null
          settings: Json
          slug: string
          state: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          billing_email?: string | null
          city?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name: string
          postal_code?: string | null
          settings?: Json
          slug: string
          state?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          billing_email?: string | null
          city?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name?: string
          postal_code?: string | null
          settings?: Json
          slug?: string
          state?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhooks: {
        Row: {
          cashfree_order_id: string | null
          cashfree_payment_id: string | null
          created_at: string
          created_by: string | null
          event_id: string | null
          event_type: string
          failure_reason: string | null
          headers: Json
          hostel_id: string | null
          id: string
          organization_id: string | null
          payment_id: string | null
          processed_at: string | null
          processing_status: string
          provider: string
          received_payload: Json
          signature_valid: boolean
          transaction_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cashfree_order_id?: string | null
          cashfree_payment_id?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          event_type: string
          failure_reason?: string | null
          headers?: Json
          hostel_id?: string | null
          id?: string
          organization_id?: string | null
          payment_id?: string | null
          processed_at?: string | null
          processing_status?: string
          provider?: string
          received_payload: Json
          signature_valid?: boolean
          transaction_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cashfree_order_id?: string | null
          cashfree_payment_id?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          event_type?: string
          failure_reason?: string | null
          headers?: Json
          hostel_id?: string | null
          id?: string
          organization_id?: string | null
          payment_id?: string | null
          processed_at?: string | null
          processing_status?: string
          provider?: string
          received_payload?: Json
          signature_valid?: boolean
          transaction_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhooks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_webhooks_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_webhooks_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_webhooks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          cashfree_order_id: string | null
          cashfree_payment_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          failure_reason: string | null
          hostel_id: string
          id: string
          idempotency_key: string | null
          invoice_finalization_attempts: number
          invoice_finalization_error: string | null
          invoice_finalization_status: Database["public"]["Enums"]["invoice_finalization_status_enum"]
          invoice_finalized_at: string | null
          invoice_id: string | null
          is_active: boolean
          is_advance: boolean
          is_partial: boolean
          lock_version: number
          manual_reference: string | null
          metadata: Json
          method: Database["public"]["Enums"]["payment_method_enum"]
          monthly_fee_record_id: string | null
          notes: string | null
          organization_id: string
          paid_at: string | null
          provider: string | null
          provider_reference: string | null
          received_by: string | null
          resident_id: string
          status: Database["public"]["Enums"]["payment_status_enum"]
          transaction_id: string | null
          updated_at: string
          updated_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          cashfree_order_id?: string | null
          cashfree_payment_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          failure_reason?: string | null
          hostel_id: string
          id?: string
          idempotency_key?: string | null
          invoice_finalization_attempts?: number
          invoice_finalization_error?: string | null
          invoice_finalization_status?: Database["public"]["Enums"]["invoice_finalization_status_enum"]
          invoice_finalized_at?: string | null
          invoice_id?: string | null
          is_active?: boolean
          is_advance?: boolean
          is_partial?: boolean
          lock_version?: number
          manual_reference?: string | null
          metadata?: Json
          method: Database["public"]["Enums"]["payment_method_enum"]
          monthly_fee_record_id?: string | null
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          received_by?: string | null
          resident_id: string
          status?: Database["public"]["Enums"]["payment_status_enum"]
          transaction_id?: string | null
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          cashfree_order_id?: string | null
          cashfree_payment_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          failure_reason?: string | null
          hostel_id?: string
          id?: string
          idempotency_key?: string | null
          invoice_finalization_attempts?: number
          invoice_finalization_error?: string | null
          invoice_finalization_status?: Database["public"]["Enums"]["invoice_finalization_status_enum"]
          invoice_finalized_at?: string | null
          invoice_id?: string | null
          is_active?: boolean
          is_advance?: boolean
          is_partial?: boolean
          lock_version?: number
          manual_reference?: string | null
          metadata?: Json
          method?: Database["public"]["Enums"]["payment_method_enum"]
          monthly_fee_record_id?: string | null
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          received_by?: string | null
          resident_id?: string
          status?: Database["public"]["Enums"]["payment_status_enum"]
          transaction_id?: string | null
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_monthly_fee_record_id_fkey"
            columns: ["monthly_fee_record_id"]
            isOneToOne: false
            referencedRelation: "monthly_fee_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      residents: {
        Row: {
          aadhaar_document_id: string | null
          aadhaar_last4: string | null
          admission_number: string
          checkout_on: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          gender: string | null
          hostel_id: string
          id: string
          is_active: boolean
          joined_on: string | null
          metadata: Json
          monthly_fee_amount: number
          notes: string | null
          organization_id: string
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          parent_user_id: string | null
          permanent_address: string | null
          phone: string | null
          preferred_name: string | null
          profile_image_document_id: string | null
          resident_type: Database["public"]["Enums"]["resident_type_enum"]
          security_deposit_amount: number
          status: Database["public"]["Enums"]["resident_status_enum"]
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          aadhaar_document_id?: string | null
          aadhaar_last4?: string | null
          admission_number: string
          checkout_on?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          gender?: string | null
          hostel_id: string
          id?: string
          is_active?: boolean
          joined_on?: string | null
          metadata?: Json
          monthly_fee_amount?: number
          notes?: string | null
          organization_id: string
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          parent_user_id?: string | null
          permanent_address?: string | null
          phone?: string | null
          preferred_name?: string | null
          profile_image_document_id?: string | null
          resident_type?: Database["public"]["Enums"]["resident_type_enum"]
          security_deposit_amount?: number
          status?: Database["public"]["Enums"]["resident_status_enum"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          aadhaar_document_id?: string | null
          aadhaar_last4?: string | null
          admission_number?: string
          checkout_on?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          gender?: string | null
          hostel_id?: string
          id?: string
          is_active?: boolean
          joined_on?: string | null
          metadata?: Json
          monthly_fee_amount?: number
          notes?: string | null
          organization_id?: string
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          parent_user_id?: string | null
          permanent_address?: string | null
          phone?: string | null
          preferred_name?: string | null
          profile_image_document_id?: string | null
          resident_type?: Database["public"]["Enums"]["resident_type_enum"]
          security_deposit_amount?: number
          status?: Database["public"]["Enums"]["resident_status_enum"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "residents_aadhaar_document_fkey"
            columns: ["aadhaar_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_parent_user_id_fkey"
            columns: ["parent_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_profile_image_document_fkey"
            columns: ["profile_image_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      room_allocations: {
        Row: {
          allocated_from: string
          allocated_to: string | null
          bed_label: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          hostel_id: string
          id: string
          monthly_fee_amount: number
          organization_id: string
          reason: string | null
          resident_id: string
          room_id: string
          status: Database["public"]["Enums"]["room_allocation_status_enum"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allocated_from: string
          allocated_to?: string | null
          bed_label?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          hostel_id: string
          id?: string
          monthly_fee_amount?: number
          organization_id: string
          reason?: string | null
          resident_id: string
          room_id: string
          status?: Database["public"]["Enums"]["room_allocation_status_enum"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allocated_from?: string
          allocated_to?: string | null
          bed_label?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          hostel_id?: string
          id?: string
          monthly_fee_amount?: number
          organization_id?: string
          reason?: string | null
          resident_id?: string
          room_id?: string
          status?: Database["public"]["Enums"]["room_allocation_status_enum"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_allocations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_allocations_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_allocations_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_allocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_allocations_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_allocations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_occupancy_view"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "room_allocations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_allocations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          base_monthly_fee: number
          block_name: string | null
          capacity: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          floor: string | null
          has_ac: boolean
          has_attached_bathroom: boolean
          hostel_id: string
          id: string
          is_active: boolean
          metadata: Json
          organization_id: string
          room_name: string | null
          room_number: string
          room_type: string
          status: Database["public"]["Enums"]["room_status_enum"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_monthly_fee?: number
          block_name?: string | null
          capacity: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          floor?: string | null
          has_ac?: boolean
          has_attached_bathroom?: boolean
          hostel_id: string
          id?: string
          is_active?: boolean
          metadata?: Json
          organization_id: string
          room_name?: string | null
          room_number: string
          room_type?: string
          status?: Database["public"]["Enums"]["room_status_enum"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_monthly_fee?: number
          block_name?: string | null
          capacity?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          floor?: string | null
          has_ac?: boolean
          has_attached_bathroom?: boolean
          hostel_id?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          organization_id?: string
          room_name?: string | null
          room_number?: string
          room_type?: string
          status?: Database["public"]["Enums"]["room_status_enum"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          assigned_to_user_id: string | null
          category: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          created_by_user_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string
          hostel_id: string
          id: string
          is_active: boolean
          metadata: Json
          organization_id: string
          priority: Database["public"]["Enums"]["support_priority_enum"]
          resident_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_status_enum"]
          subject: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to_user_id?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_user_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description: string
          hostel_id: string
          id?: string
          is_active?: boolean
          metadata?: Json
          organization_id: string
          priority?: Database["public"]["Enums"]["support_priority_enum"]
          resident_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_status_enum"]
          subject: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to_user_id?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_user_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          hostel_id?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          organization_id?: string
          priority?: Database["public"]["Enums"]["support_priority_enum"]
          resident_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_status_enum"]
          subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          hostel_id: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          organization_id: string
          permissions: Json
          role: Database["public"]["Enums"]["user_role_enum"]
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          hostel_id?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          organization_id: string
          permissions?: Json
          role: Database["public"]["Enums"]["user_role_enum"]
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          hostel_id?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          organization_id?: string
          permissions?: Json
          role?: Database["public"]["Enums"]["user_role_enum"]
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_document_id: string | null
          created_at: string
          created_by: string | null
          default_role: Database["public"]["Enums"]["user_role_enum"]
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          is_platform_user: boolean
          last_login_at: string | null
          metadata: Json
          organization_id: string | null
          phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          avatar_document_id?: string | null
          created_at?: string
          created_by?: string | null
          default_role?: Database["public"]["Enums"]["user_role_enum"]
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          is_platform_user?: boolean
          last_login_at?: string | null
          metadata?: Json
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          avatar_document_id?: string | null
          created_at?: string
          created_by?: string | null
          default_role?: Database["public"]["Enums"]["user_role_enum"]
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          is_platform_user?: boolean
          last_login_at?: string | null
          metadata?: Json
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_avatar_document_fkey"
            columns: ["avatar_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      website_settings: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          hostel_id: string | null
          id: string
          is_active: boolean
          organization_id: string
          published_at: string | null
          published_by: string | null
          section_key: string
          seo_description: string | null
          seo_title: string | null
          status: Database["public"]["Enums"]["cms_status_enum"]
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          hostel_id?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          published_at?: string | null
          published_by?: string | null
          section_key: string
          seo_description?: string | null
          seo_title?: string | null
          status?: Database["public"]["Enums"]["cms_status_enum"]
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          hostel_id?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          published_at?: string | null
          published_by?: string | null
          section_key?: string
          seo_description?: string | null
          seo_title?: string | null
          status?: Database["public"]["Enums"]["cms_status_enum"]
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_settings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_settings_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_settings_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_settings_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      resident_balance_view: {
        Row: {
          hostel_id: string | null
          organization_id: string | null
          resident_id: string | null
          total_due: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_fee_records_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_fee_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_fee_records_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      room_occupancy_view: {
        Row: {
          available_count: number | null
          capacity: number | null
          hostel_id: string | null
          occupied_count: number | null
          organization_id: string | null
          room_id: string | null
          room_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assign_default_role: {
        Args: {
          role_permissions?: Json
          target_hostel_id?: string
          target_organization_id: string
          target_role?: Database["public"]["Enums"]["user_role_enum"]
          target_user_id: string
        }
        Returns: string
      }
      belongs_to_organization: { Args: { org_id: string }; Returns: boolean }
      can_access_user: { Args: { target_user_id: string }; Returns: boolean }
      can_manage_finance: {
        Args: { hostel_id?: string; org_id: string }
        Returns: boolean
      }
      can_manage_organization: {
        Args: { hostel_id?: string; org_id: string }
        Returns: boolean
      }
      can_read_notice: { Args: { target_notice_id: string }; Returns: boolean }
      dearmor: { Args: { "": string }; Returns: string }
      gen_random_uuid: { Args: never; Returns: string }
      gen_salt: { Args: { "": string }; Returns: string }
      get_current_organization_id: { Args: never; Returns: string }
      get_current_user_id: { Args: never; Returns: string }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role_enum"]
      }
      get_default_hostel_id: { Args: never; Returns: string }
      get_default_organization_id: { Args: never; Returns: string }
      has_role_in_organization: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["user_role_enum"][]
          target_hostel_id?: string
          target_organization_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_resident: { Args: never; Returns: boolean }
      is_service_context: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      onboard_admin: {
        Args: {
          target_hostel_id?: string
          target_organization_id: string
          target_role?: Database["public"]["Enums"]["user_role_enum"]
          target_user_id: string
        }
        Returns: string
      }
      onboard_resident: {
        Args: { target_resident_id: string; target_user_id: string }
        Returns: string
      }
      owns_resident: { Args: { target_resident_id: string }; Returns: boolean }
      pgp_armor_headers: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      safe_uuid: { Args: { input: string }; Returns: string }
      storage_object_organization_id: {
        Args: { object_name: string }
        Returns: string
      }
      storage_object_resident_id: {
        Args: { object_name: string }
        Returns: string
      }
      sync_auth_user: { Args: { target_user_id: string }; Returns: string }
    }
    Enums: {
      cms_status_enum: "draft" | "published" | "archived"
      document_status_enum:
        | "pending"
        | "verified"
        | "rejected"
        | "expired"
        | "archived"
      document_type_enum:
        | "aadhaar"
        | "profile_image"
        | "guardian_id"
        | "hostel_agreement"
        | "invoice_pdf"
        | "payment_receipt"
        | "gallery_image"
        | "facility_image"
        | "student_id"
        | "support_attachment"
        | "other"
      fee_record_status_enum:
        | "pending"
        | "partial"
        | "paid"
        | "overdue"
        | "waived"
        | "cancelled"
      invoice_status_enum:
        | "draft"
        | "issued"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "cancelled"
      invoice_finalization_status_enum:
        | "not_required"
        | "pending"
        | "in_progress"
        | "succeeded"
        | "failed"
      leave_status_enum:
        | "pending"
        | "approved"
        | "rejected"
        | "departed"
        | "returned"
        | "cancelled"
      notification_channel_enum: "in_app" | "email" | "sms" | "whatsapp"
      notification_status_enum:
        | "queued"
        | "sending"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
        | "cancelled"
      payment_method_enum:
        | "cash"
        | "upi"
        | "bank_transfer"
        | "card"
        | "netbanking"
        | "wallet"
        | "cashfree"
        | "advance"
        | "adjustment"
      payment_status_enum:
        | "initiated"
        | "pending"
        | "verified"
        | "failed"
        | "cancelled"
        | "refunded"
        | "partially_refunded"
      resident_status_enum:
        | "draft"
        | "pending_finance"
        | "active"
        | "suspended"
        | "checked_out"
        | "archived"
      resident_type_enum: "student" | "employee" | "other"
      room_allocation_status_enum:
        | "active"
        | "transferred"
        | "completed"
        | "cancelled"
      room_status_enum: "active" | "maintenance" | "inactive" | "archived"
      support_priority_enum: "low" | "medium" | "high" | "urgent"
      support_status_enum:
        | "open"
        | "in_progress"
        | "waiting_on_resident"
        | "resolved"
        | "closed"
      user_role_enum:
        | "super_admin"
        | "owner"
        | "admin"
        | "finance"
        | "receptionist"
        | "warden"
        | "staff"
        | "resident"
        | "parent"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      cms_status_enum: ["draft", "published", "archived"],
      document_status_enum: [
        "pending",
        "verified",
        "rejected",
        "expired",
        "archived",
      ],
      document_type_enum: [
        "aadhaar",
        "profile_image",
        "guardian_id",
        "hostel_agreement",
        "invoice_pdf",
        "payment_receipt",
        "gallery_image",
        "facility_image",
        "student_id",
        "support_attachment",
        "other",
      ],
      fee_record_status_enum: [
        "pending",
        "partial",
        "paid",
        "overdue",
        "waived",
        "cancelled",
      ],
      invoice_status_enum: [
        "draft",
        "issued",
        "partially_paid",
        "paid",
        "overdue",
        "cancelled",
      ],
      invoice_finalization_status_enum: [
        "not_required",
        "pending",
        "in_progress",
        "succeeded",
        "failed",
      ],
      leave_status_enum: [
        "pending",
        "approved",
        "rejected",
        "departed",
        "returned",
        "cancelled",
      ],
      notification_channel_enum: ["in_app", "email", "sms", "whatsapp"],
      notification_status_enum: [
        "queued",
        "sending",
        "sent",
        "delivered",
        "read",
        "failed",
        "cancelled",
      ],
      payment_method_enum: [
        "cash",
        "upi",
        "bank_transfer",
        "card",
        "netbanking",
        "wallet",
        "cashfree",
        "advance",
        "adjustment",
      ],
      payment_status_enum: [
        "initiated",
        "pending",
        "verified",
        "failed",
        "cancelled",
        "refunded",
        "partially_refunded",
      ],
      resident_status_enum: [
        "draft",
        "pending_finance",
        "active",
        "suspended",
        "checked_out",
        "archived",
      ],
      resident_type_enum: ["student", "employee", "other"],
      room_allocation_status_enum: [
        "active",
        "transferred",
        "completed",
        "cancelled",
      ],
      room_status_enum: ["active", "maintenance", "inactive", "archived"],
      support_priority_enum: ["low", "medium", "high", "urgent"],
      support_status_enum: [
        "open",
        "in_progress",
        "waiting_on_resident",
        "resolved",
        "closed",
      ],
      user_role_enum: [
        "super_admin",
        "owner",
        "admin",
        "finance",
        "receptionist",
        "warden",
        "staff",
        "resident",
        "parent",
      ],
    },
  },
} as const
