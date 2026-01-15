# VOS Education Hub - Project TODO

## Phase 1: Database Schema & Content Structure
- [x] Extend database schema with VOS-specific tables (pillars, quizzes, progress, certifications, maturity assessments)
- [x] Create content data structure for 10 VOS pillars
- [ ] Set up role-based curriculum definitions (Sales, CS, Marketing, Product, Executive, VE)
- [ ] Define maturity level progression logic (0-5)
- [x] Create quiz question bank for Pillar 1 (Unified Value Language)
- [x] Set up database helpers in server/db.ts

## Phase 2: Core UI & Navigation
- [x] Design and implement landing page with VOS branding
- [x] Create dashboard layout with sidebar navigation
- [ ] Build user profile page showing maturity level and progress
- [ ] Implement role selection interface
- [ ] Create learning path navigation (10 pillars)
- [x] Set up routing for all major pages
- [x] Apply VOS blue-green color palette theme
- [x] Copy provided visualization assets to public folder

## Phase 3: Pillar Content Pages
- [ ] Create PillarModule component for content display
- [ ] Build pillar overview pages (1-10)
- [ ] Integrate static visualizations (maturity chart, role grid, etc.)
- [ ] Add downloadable resources (KPI sheets, templates)
- [ ] Implement content unlocking based on progress

## Phase 4: Adaptive Quiz System
- [ ] Build QuizInterface component with question rendering
- [ ] Implement adaptive scoring logic (maturity-based)
- [ ] Create instant feedback system tied to maturity levels
- [ ] Build quiz result display with category breakdown
- [ ] Implement 80% pass threshold for certification
- [ ] Add quiz retake functionality with targeted drills
- [ ] Create role-specific question adaptations
- [ ] Build scenario-based question types

## Phase 5: Progress Tracking & Analytics
- [ ] Implement user progress tracking system
- [ ] Create progress dashboard with completion percentages
- [ ] Build maturity level assessment interface
- [ ] Implement maturity progression visualization
- [ ] Create certification badge system
- [ ] Build analytics dashboard (admin view)
- [ ] Track completion rates per pillar
- [ ] Measure knowledge gain (pre/post quiz scores)

## Phase 6: Simulations & Interactive Components
- [ ] Build Value Tree builder component
- [ ] Create simulation flow for lifecycle workflows
- [ ] Implement cross-functional handoff scenarios
- [ ] Build Value Commit template interface
- [ ] Create QBR/EBR template builder
- [ ] Add multi-step flow navigation

## Phase 7: TheSys C1 Integration
- [ ] Set up TheSys C1 API credentials
- [ ] Integrate C1 SDK into frontend
- [ ] Build AI Tutor using C1Chat component
- [ ] Implement role and maturity-aware system prompts
- [ ] Create adaptive quiz generation with C1
- [ ] Build personalized guidance system
- [ ] Test generative UI components

## Phase 8: Resource Library
- [ ] Create resource library page
- [ ] Add KPI Definition Sheet (downloadable PDF)
- [ ] Add Discovery Questions framework
- [ ] Add Value Commit templates
- [ ] Add QBR/EBR templates
- [ ] Add B2BValue Company Playbook excerpts
- [ ] Organize resources by pillar and role

## Phase 9: Certification System
- [ ] Build certification logic (80% threshold)
- [ ] Create role-specific badge designs
- [ ] Implement certificate generation
- [ ] Build certification display on user profile
- [ ] Add certification download functionality
- [ ] Create certification leaderboard

## Phase 10: Testing & Refinement
- [x] Write vitest tests for quiz scoring logic
- [x] Write vitest tests for maturity progression
- [x] Write vitest tests for certification awarding
- [ ] Test adaptive content delivery
- [ ] Test role-based curriculum paths
- [ ] Validate all quiz feedback mechanisms
- [ ] Test TheSys C1 integration
- [ ] Mobile responsiveness testing
- [ ] Accessibility compliance check

## Phase 11: Polish & Documentation
- [ ] Add loading states for all async operations
- [ ] Implement error handling and user feedback
- [ ] Create onboarding flow for new users
- [ ] Add help tooltips and guidance
- [ ] Write user documentation
- [ ] Create admin guide for analytics
- [ ] Add FAQ section
- [ ] Optimize performance

## Future Enhancements (Post-MVP)
- [ ] Add remaining pillars (2-10) with full quiz content
- [ ] Implement AI Prompt Library (Pillars 9-10)
- [ ] Add team/cohort management for organizations
- [ ] Build advanced analytics with cohort comparison
- [ ] Add gamification elements (points, streaks)
- [ ] Implement peer learning features
- [ ] Add video content integration
- [ ] Build mobile app version

## Bug Fixes
- [x] Fix nested anchor tag error in Dashboard component (Link wrapping <a>)

## New Requirements from Flowith Document

### Content Completion
- [x] Complete Pillar 2-10 content with Topics, Outputs, and Resources
- [x] Add downloadable resource templates for each pillar
- [ ] Create GenAI Prompt Library for Pillar 9

### Role-Based Curriculum
- [ ] Implement role-based learning path filtering
- [ ] Create progressive module unlocking (L0→L1→L2→L3)
- [ ] Add module completion checkboxes
- [ ] Build role-specific assessment paths

### Enhanced Certification System
- [ ] Implement Bronze/Silver/Gold tier system
- [ ] Add final simulation assessment covering full value lifecycle
- [ ] Implement 40/30/30 scoring rubric (Technical/Cross-Functional/AI)
- [ ] Create certificate generation system

### Maturity Assessment Tool
- [ ] Build self-assessment questionnaire
- [ ] Display characteristics, symptoms, and actions for each level
- [ ] Add personalized recommendations based on current level
- [ ] Track progression from L0→L5

### Interactive Simulations
- [ ] AI-powered discovery session practice
- [ ] Value Tree building interactive exercise
- [ ] Business case development scenario
- [ ] QBR expansion modeling simulation

### Resource Library
- [ ] Create downloadable templates section
- [ ] Add playbooks and guides
- [ ] Implement GenAI Prompt Library interface
- [ ] Add policy documents download

## Current Bug Fixes
- [x] Fix nested anchor tag error in Profile page

## Bug Fixes (Current)
- [x] Fix nested anchor tag error in Dashboard component

## Urgent Bug Fix
- [x] Fix persistent nested anchor tag error in Dashboard (Link + Button issue)

## Critical Bug Fix
- [x] Fix nested anchor tag error on Home page (landing page)

## Next Development Phase
- [x] Build Pillar Overview page with full content display
- [x] Build Resources library page with downloadable templates
- [ ] Add quiz questions for Pillars 2-10 (currently only Pillar 1 has questions)
- [ ] Enhance Profile page with interactive maturity assessment tool
- [ ] Integrate AI tutor for simulations and adaptive learning
- [x] Write vitest tests for core features

## Academy Distinctive Features (New Requirements)

### 1. Role-Based Maturity Progression
- [x] Implement role-specific maturity tracks (Sales Engineer, Value Consultant, CRO, etc.)
- [x] Map behaviors and capabilities to maturity levels
- [x] Add outcome-based checkpoints (% value-aligned deals, ROI model reuse rate)
- [x] Create measurable business impact tracking

### 2. Embedded Agentic Systems
- [x] Build live AI agents trained on user workflows
- [x] Implement real-time composition engine for:
  - [x] KPI hypotheses
  - [x] ROI narratives
  - [x] Value case libraries
- [x] Create learning-by-doing with agents interfacedoing with agents" experience

### 3. VOS Foundation Integration
- [ ] Anchor all content in VOS framework (4-Stage Business Process)
- [ ] Integrate Value Maturity Models throughout
- [ ] Add Governance and Role Alignment features
- [ ] Enable VOS practice in real selling contexts

### 4. Interactive, Immersive UX
- [ ] Create visual, clickable learning flows
- [ ] Build embedded canvases and prompt interfaces
- [ ] Implement model simulations
- [ ] Add smart branching based on learner input
- [ ] Create behavioral simulations for:
  - [ ] Value realization storytelling
  - [ ] Objection handling
  - [ ] Insight framing

### 5. Data-Driven Personalization
- [ ] Implement team-specific performance data tracking
- [ ] Add maturity benchmarking system
- [ ] Create industry and deal-type clustering
- [ ] Build closed-loop learning + operating environment

### 6. Strategic Enablement System
- [ ] Build curated value model libraries
- [ ] Create maturity benchmarking dashboards
- [ ] Implement GTM pipeline acceleration tools
- [ ] Enable continuous org capability sharpening

### 7. Industry-Relevant, Future-Forward Content
- [ ] Add modules on AI, IoT, LLMs in enterprise selling
- [ ] Implement adaptive content based on industry trends
- [ ] Enable competitive shift responsiveness
- [ ] Create evolving VOS asset system

## Documentation
- [x] Create user guide for Agentic AI Tutor feature

## Resource Downloads
- [x] Create actual downloadable files for all 12 resources
- [x] Generate PDF templates for Value Stream Mapping, Business Case, ROI Calculator
- [x] Create Excel/CSV templates for metrics and calculators
- [x] Update database with real file URLs
- [ ] Test download functionality

## Certification System
- [x] Build Bronze certification (pass all knowledge checks)
- [x] Build Silver certification (80%+ on final simulation)
- [x] Build Gold certification (95%+ with exceptional insight)
- [x] Create certification badge display system
- [ ] Implement certification verification and sharing
- [x] Add certification progress tracking

## Practical Application
- [ ] Create interactive simulation framework
- [ ] Build value discovery simulation
- [ ] Build business case development simulation
- [ ] Build objection handling scenarios
- [ ] Add AI-powered feedback system
- [ ] Implement scenario scoring and evaluation

## Interactive Simulations (New Feature)
- [x] Design simulation framework and data models
- [x] Create simulation database schema (scenarios, responses, evaluations)
- [x] Build Value Discovery Session simulation with AI feedback
- [ ] Build Business Case Development simulation
- [ ] Build QBR Expansion Modeling simulation
- [x] Implement 40/30/30 scoring rubric for simulations
- [ ] Add role-specific scenario adaptations
- [x] Create simulation results and progress tracking
- [x] Test simulation scenario
- [x] Integrate simulations into learning paths

## Navigation Update
- [x] Add Simulations link to dashboard sidebar navigation

## Design System Enhancement
- [x] Update Tailwind config with comprehensive brand tokens
- [x] Implement color system with light/dark mode support
- [x] Add typography tokens (Inter font family, letter spacing)
- [x] Define shadow tokens for depth hierarchy
- [x] Set up radius tokens for consistent rounded corners
- [x] Document design token usage guidelines

## UI Modernization & Rebranding
- [x] Inspect and document current UI patterns
- [x] Refine brand tokens for educational context
- [x] Refactor Home page with design system
- [ ] Refactor Dashboard layout
- [ ] Refactor Pillar overview pages
- [ ] Refactor Quiz interface
- [x] Refactor Simulations interface
- [ ] Refactor AI Tutor interface
- [ ] Refactor Certifications page
- [ ] Refactor Resources page
- [ ] Refactor Profile page
- [x] Add hover states and transitions
- [ ] Implement progress animations
- [x] Add micro-interactions
- [x] Create migration guide

## Dashboard & Quiz Design System Application
- [x] Refactor Dashboard page with shadow tokens and hover states
- [x] Refactor Quiz page with modern design system
- [x] Test visual consistency across pages

## ValueCanvas Branding Application
- [x] Analyze ValueCanvas design language
- [x] Enhance dark mode with deeper blacks (#000)
- [x] Add monospace font for scores and metrics
- [x] Create status pill components (In Progress, Completed, Locked)
- [x] Strengthen teal accent usage throughout
- [x] Enhance certification badge styling
- [x] Add technical aesthetic elements
- [x] Test dark mode across all pages

## ValueCanvas Visual Alignment
- [x] Replace teal gradient hero with pure black background
- [x] Add subtle grid pattern to hero section (like ValueCanvas)
- [x] Update hero typography to match ValueCanvas bold style
- [x] Make "VOS® System Online" badge more prominent
- [x] Update button styling to match ValueCanvas white pills
- [x] Ensure consistent dark aesthetic across all pages
- [x] Test visual consistency with ValueCanvas website

## Rebrand to VOS Academy
- [x] Update VITE_APP_TITLE environment variable to "VOS Academy"
- [x] Update all page titles and meta tags
- [x] Update header branding text
- [x] Update footer copyright text
- [x] Verify all brand references are consistent

## Sidebar Layout Redesign
- [x] Create new SidebarLayout component with search bar
- [x] Redesign Home page with sidebar navigation
- [x] Update Dashboard to use new sidebar layout
- [x] Implement search functionality to filter pillars/resources/simulations
- [x] Add mobile responsive sidebar with hamburger menu
- [x] Update Quiz page with SidebarLayout
- [x] Update Simulations page with SidebarLayout
- [x] Update AI Tutor page with SidebarLayout
- [x] Update Certifications page with SidebarLayout
- [x] Update Resources page with SidebarLayout
- [x] Update Profile page with SidebarLayout
- [x] Update PillarOverview page with SidebarLayout
- [x] Test search functionality across all content types
- [x] Test mobile responsive behavior on small screens

## Business Case Development Simulation (New)
- [x] Review BUSINESS_CASE_AI_PROMPTS.md and SIMULATION_DESIGN_SPEC.md
- [x] Add Business Case Development scenario to database seed
- [x] Create backend API endpoint for Business Case simulation submission
- [x] Implement AI evaluation logic using provided prompts
- [x] Build frontend UI component for Business Case simulation
- [x] Add navigation link to new simulation
- [x] Write vitest tests for Business Case simulation
- [x] Test end-to-end functionality
- [x] Save checkpoint with new simulation

## QBR Expansion Modeling Simulation (New)
- [x] Review QBR simulation design from SIMULATION_DESIGN_SPEC.md
- [x] Create AI evaluation prompts document for QBR simulation
- [x] Add QBR Expansion scenario to database seed
- [x] Implement QBR evaluation logic in backend
- [x] Write vitest tests for QBR simulation
- [x] Test end-to-end functionality
- [x] Save checkpoint with QBR simulation

## Simulation Progress Dashboard (New)
- [x] Design dashboard layout with analytics sections
- [x] Create backend API endpoint for user simulation analytics
- [x] Build SimulationProgress page component
- [x] Add score trend chart (line chart over time)
- [x] Add category breakdown chart (radar/spider chart)
- [x] Add attempt history table with filters
- [x] Add overall statistics cards (total attempts, avg score, best score)
- [x] Add navigation link to dashboard
- [x] Write vitest tests for analytics endpoints
- [x] Test dashboard functionality
- [x] Save checkpoint with progress dashboard

## AI Recommendation Engine (New)
- [x] Design recommendation algorithm logic
- [x] Create backend API endpoint for personalized recommendations
- [x] Implement AI analysis of user progress data
- [x] Generate recommendations for next simulations
- [x] Generate recommendations for pillars to study
- [x] Generate recommendations for skill improvement areas
- [x] Build RecommendationsCard component
- [x] Add recommendations to Dashboard page
- [x] Add recommendations to Progress page
- [x] Write vitest tests for recommendation logic
- [x] Test recommendation accuracy
- [x] Save checkpoint with recommendation engine

## Quiz Content Expansion (Pillars 2-10)
- [x] Review existing Pillar 1 quiz questions structure
- [x] Create 10-12 questions for Pillar 2: Value Data Model Mastery
- [x] Create 10-12 questions for Pillar 3: Discovery Excellence
- [x] Create 10-12 questions for Pillar 4: Business Case Development
- [x] Create 10-12 questions for Pillar 5: Lifecycle Handoffs & Governance
- [x] Create 10-12 questions for Pillar 6: Realization Tracking & Value Proof
- [x] Create 10-12 questions for Pillar 7: Expansion & Benchmarking Strategy
- [x] Create 10-12 questions for Pillar 8: Cross-Functional Collaboration Patterns
- [x] Create 10-12 questions for Pillar 9: AI-Augmented Value Workflows
- [x] Create 10-12 questions for Pillar 10: Leadership & Culture of Value
- [x] Seed all questions to database
- [x] Verify quiz functionality across all pillars
- [x] Save checkpoint with expanded quiz content
