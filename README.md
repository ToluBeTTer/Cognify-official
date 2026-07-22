# Cognify - SAT Question Help Platform

## Overview

Cognify is a specialized SAT-focused educational platform that combines AI-powered immediate assistance with human expert responses. Students can submit SAT questions via text or screenshots, receive instant AI help, and optionally get detailed human responses from verified content creators (tutors).

## Problem Statement

Students preparing for the SAT often encounter difficult questions that require more than just an answer explanation. They need:

- Immediate help when stuck on practice problems
- Detailed, step-by-step explanations tailored to their level
- Access to human tutors for complex concepts
- A structured way to practice and track progress
- A centralized question bank for targeted study

Cognify solves this by providing a hybrid AI + human support system specifically designed for SAT preparation.

## Target Users

### Students (Primary)
- High school students preparing for the SAT
- Need quick help with specific questions
- Want to track their progress and identify weak areas
- May request human explanations for difficult concepts

### Content Creators / Tutors
- Verified tutors and educators
- Review student questions and provide video/text responses
- Earn recognition through quality contributions
- Can import high-quality questions to the question bank

### Administrators
- Platform operators
- Manage user roles (approve tutors, promote to admin)
- Oversee question quality and content
- Monitor platform analytics and audit logs

---

## Core Features

### 1. Question Submission System

Students can submit SAT questions in two ways:

- **Text Input**: Type or paste the question text directly
- **Image Upload**: Upload screenshots of questions from practice tests or textbooks

Each submission includes:
- Subject area (Math, Reading, Writing)
- Topic/subtopic classification
- Difficulty level
- Optional attachments

### 2. AI Assistant (Milo)

**Milo** is the built-in AI tutor that provides:
- Immediate explanations for submitted questions
- Step-by-step solutions
- Related concept explanations
- Practice recommendations

Milo is available 24/7 and integrated throughout the platform.

### 3. Human Response Queue

Questions can optionally be escalated for human review:

**For Students:**
- Request detailed human explanation
- Save responses for later review
- Rate response quality

**For Creators:**
- Browse pending request queue
- Claim questions matching their expertise
- Submit video or text responses
- Track response statistics

### 4. Question Bank

A curated collection of SAT questions:
- Organized by SAT domain (Algebra, Geometry, Reading Comprehension, etc.)
- Filter by difficulty, topic, and question type
- Seed packs with 100+ pre-loaded questions
- Community contributions via import pipeline
- Quality-controlled by admins

### 5. Study Center & Practice Engine

**Study Modes:**
1. **Question Bank Practice**: Work through curated questions
2. **Adaptive Practice**: AI-powered question selection based on performance
3. **Timed Tests**: Simulate real SAT conditions
4. **Weakness Focus**: Target specific problem areas

**Features:**
- Session statistics and progress tracking
- Spaced repetition for missed questions
- Performance analytics by topic
- Practice history

### 6. Progress Tracking

Dashboard showing:
- Questions asked vs. answered
- Accuracy by subject/topic
- Study streaks and time spent
- Improvement over time
- Weak areas identification

### 7. Role-Based Access

**Student Role:**
- Submit questions
- Access AI help
- Practice with question bank
- View progress stats
- Request human responses

**Creator Role:**
- All student features
- Access to request queue
- Claim and respond to questions
- Upload video responses
- Import questions to bank

**Admin Role:**
- All creator features
- User management (approve roles)
- Platform analytics
- Audit log access
- Question bank moderation
- Team management

---

## Technical Architecture

### Frontend
- **Next.js 14** with App Router
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- Theme support (light/dark mode)
- Fully responsive design (mobile + desktop)

### Backend
- **Supabase** for:
  - Authentication (email/password)
  - PostgreSQL database with RLS
  - Storage buckets (images, videos)
  - Edge functions for serverless logic

### Database Schema
- `profiles` - User accounts with role-based access
- `questions` - Student question submissions
- `question_attachments` - Images/files for questions
- `responses` - Creator video/text responses
- `question_bank` - Curated SAT questions
- `practice_sessions` - Practice tracking
- `saved_explanations` - Student bookmarks
- `notifications` - In-app notifications
- `audit_logs` - Platform activity tracking

### Security
- Row Level Security (RLS) on all tables
- Role-based access control
- Authenticated API routes
- Private storage buckets with signed URLs
- Audit logging for sensitive actions

---

## User Flows

### Student Question Flow
1. Student navigates to "Ask Question"
2. Enters question text or uploads screenshot
3. Selects subject/topic
4. Submits question
5. Immediately receives AI explanation from Milo
6. Optionally requests human response
7. Views response in "Human Responses" section
8. Saves helpful explanations for review

### Creator Response Flow
1. Creator logs into Creator Dashboard
2. Views Request Queue
3. Filters by subject/expertise
4. Claims a question
5. Records video response or writes explanation
6. Submits response
7. Response appears in student's queue
8. Creator receives rating/feedback

### Admin Management Flow
1. Admin accesses Admin Panel
2. Reviews pending role requests
3. Approves/denies creator applications
4. Monitors question queue status
5. Reviews audit logs for unusual activity
6. Manages question bank quality
7. Views platform analytics

---

## File Structure

```
app/
├── (app)/           # Student-facing routes
│   ├── dashboard/
│   ├── questions/
│   ├── study/
│   ├── practice/
│   └── question-bank/
├── (auth)/          # Login/signup
├── (creator)/       # Creator dashboard
│   ├── queue/
│   ├── claims/
│   └── respond/
└── (admin-hub)/     # Admin panel
    ├── team/
    ├── creators/
    └── logs/

components/
├── layout/          # Sidebars, headers
├── ui/              # Reusable components
└── milo/            # AI assistant

lib/
├── supabase/        # Database client & auth
├── practice/        # Practice engine
└── ai/              # AI provider integration

supabase/migrations/ # Database schema
```

---

## Design Philosophy

### Visual Identity
- Dark navy primary color
- Clean, academic aesthetic
- Professional, modern feel
- Consistent Cognify branding with custom logo

### User Experience
- Minimal friction for question submission
- Clear visual hierarchy
- Intuitive navigation by role
- Responsive design for all devices
- Accessible color contrasts

### Mobile Support
- Collapsible sidebars on mobile
- Touch-friendly interactions
- Optimized text sizing
- No horizontal overflow
- Full feature parity with desktop

---

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account

### Installation

```bash
# Extract the project
unzip cognify-project.zip
cd project

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Supabase credentials

# Run development server
npm run dev
```

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Deployment

The project is configured for easy deployment to:
- **Vercel** (recommended for Next.js)
- **Netlify** (configuration included)

---

## Future Roadmap

- Real-time chat with tutors
- Achievements/badges, Streak Mode, Daily Challenge
- Full-length adaptive practice test simulations
- Study group features
- Mobile app (React Native)
- Payment integration for premium tutoring
- Integration with College Board APIs
- Next.js 13 → latest major version upgrade

## Already Built (this section used to list these as roadmap — they're live)

- AI-powered procedural question generation (Infinite Practice), server-validated before caching
- Predicted SAT Score, on the real 1600 scale with difficulty weighting
- Live-adaptive Challenge Mode (streak-based, server-computed difficulty)
- Multi-provider AI fallback chain (Gemini → Groq → OpenRouter → Anthropic)
- Struggle-detection: after 2+ misses in a row during practice, students are proactively offered a tutor escalation

---

## Contact & Support

Cognify is a specialized platform built specifically for SAT preparation, focusing on the intersection of AI assistance and human expertise to provide students with the best possible support for their test preparation journey.
