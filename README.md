# 🚀 FOMO – Social Events Platform

<p align="center">
  <img width="800" alt="FOMO Logo" src="https://github.com/user-attachments/assets/a3a4a4bf-b1b5-4682-b2f3-60aa906a7b34" />
</p>

[![React Native](https://img.shields.io/badge/React%20Native-2025-blue?logo=react)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3FCF8E?logo=supabase)](https://supabase.com/)
[![Deno Edge Functions](https://img.shields.io/badge/Deno%20Edge%20Functions-Serverless-black?logo=deno)](https://deno.com/)
[![Status](https://img.shields.io/badge/Launching-Feb%202026-orange)](#)

---

## 📱 Project Overview

**FOMO** is a scalable, mobile-first social platform engineered to redefine how users discover, create, and share real-time events. The application bridges the gap between seamless UX and robust backend architecture, allowing users to connect via instant messaging, manage event attendance, and explore local activities with a focus on privacy and performance.

**Core Goal:** To maximize social engagement through a friction-free, secure, and highly responsive mobile experience.

---

## 🛠 Technical Architecture

This project adopts a modern **Serverless-first** approach to ensure high scalability and maintainability.

### Frontend
- **React Native + TypeScript:** Cross-platform native UI for iOS and Android.
- **Strict Type Safety:** Comprehensive typing across the entire codebase to prevent runtime errors.
- **State Management:** Structured navigation and global state handling for a fluid user experience.
- **Expo Ecosystem:** Leveraged for agile development and streamlined multi-platform deployment.

### Backend (BaaS)
- **Supabase (PostgreSQL):** Relational database engine optimized for scale.
- **Real-time Subscriptions:** WebSockets integration for live feeds, chat, and event updates.
- **Auth & Storage:** Secure authentication flows (Email/Password, OAuth) and scalable media buckets.

### Edge Functions
- **Deno (TypeScript):** Serverless compute for complex business logic.
- **Administrative Operations:** Handling sensitive tasks like GDPR data export, account deletion, and transactional emails securely via Service Role Keys.
- **Integration:** Connected with Resend API for transactional messaging.

### Security & Compliance
- **Row Level Security (RLS):** Granular permission policies applied to every sensitive table. Ensures data isolation where only the owner can read/write their records.
- **GDPR Compliance:**
  - **Data Portability:** Automated HTML-formatted data export sent via email.
  - **Right to be Forgotten:** Secure RPC functions for complete, irreversible account deletion.

<p align="center">
  <img src="https://github.com/user-attachments/assets/1866e3ae-dfc9-4832-bd26-fbb028411a03" alt="FOMO Dashboard Interface" width="300" />
</p>

---

## ⚡ Key Features

- **🔐 Secure Authentication:** Robust login/signup flows via Supabase Auth.
- **📡 Real-time Event Feed:** Live updates on social activities nearby.
- **📅 Event Management:** Full CRUD capabilities for creating and managing social gatherings.
- **💬 Instant Messaging:** Low-latency chat system between users.
- **🤝 Social Graph:** Friend requests and relationship management logic.
- **⚖️ GDPR Toolkit:** Automated tools for data export and account deletion.
- **🔔 Smart Notifications:** Push notifications for engagement and reminders.
- **🎨 Adaptive UI:** Custom branding and responsive design patterns.

---

## 🧠 Challenge & Solution

**The Challenge:** Implementing a fully GDPR-compliant account deletion flow that respects strict Row Level Security (RLS) policies without causing permission errors during cascading deletions.

**The Solution:**
- **Atomic Transactions:** Engineered a parameterized RPC function (`delete_account_completely(uuid)`) using `SECURITY DEFINER` in PostgreSQL to execute deletions atomically, bypassing RLS limitations for this specific administrative action.
- **Safety Policies:** Implemented specific RLS policies to ensure users can only trigger self-deletion.
- **Cache Management:** Integrated schema reload triggers to prevent caching issues in PostgREST after deletion.
- **Feedback Loop:** The frontend handles the RPC invocation and manages user feedback, ensuring legal traceability and a clean UI state.

---

## 🚀 Roadmap

- [x] Full-stack Architecture & MVP Deployment
- [x] Edge Functions for Advanced Logic & GDPR Compliance
- [x] Advanced Security (RLS, Service Role, Secure Export)
- [x] Mobile-first UI/UX & Real-time Engine
- [ ] **Integration of AI Agents (Master's Focus):**
  - Automated content moderation (Text/Image).
  - Personalized event recommendation algorithms.
  - Behavioral analysis for spam prevention.

---

> **Note:** This repository serves as a **public showcase**. The full source code is private as the product is scheduled for commercial launch in **April 2026**.

*Developed by Javier Pozo*
