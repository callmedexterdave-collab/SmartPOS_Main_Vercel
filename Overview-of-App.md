# Overview

SmartPOS+ is a fully offline Progressive Web Application (PWA) designed as a point-of-sale system for small and medium enterprises (SMEs). The application operates entirely without internet connectivity, featuring barcode scanning, inventory management, sales tracking, and role-based authentication. Built with React, TypeScript, and modern web technologies, it provides a mobile-first experience optimized for Android devices while maintaining cross-platform compatibility.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: React Context API for authentication and application state, React Query for data fetching and caching
- **UI Framework**: Shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling
- **PWA Features**: Service worker implementation for offline functionality, web app manifest for native app-like experience
- **Build Tool**: Vite for fast development and optimized production builds

## Data Storage
- **Primary Database**: IndexedDB via Dexie.js for client-side data persistence
- **Fallback Storage**: LocalStorage for configuration and lightweight data
- **Schema Management**: Drizzle ORM for type-safe database operations and migrations
- **Data Synchronization**: Built-in offline-first approach with eventual consistency patterns

## Authentication & Authorization
- **Role-Based Access Control**: Two-tier system with Admin (full access) and Staff (limited to sales operations)
- **Password Security**: bcryptjs for password hashing and validation
- **Session Management**: Local storage-based authentication with automatic session restoration
- **Security Features**: Admin verification required for sensitive operations like item deletion

## Mobile & Device Integration
- **Camera Access**: Native camera API integration for barcode scanning using @zxing/library
- **Touch Optimization**: Mobile-first responsive design with touch-friendly interfaces
- **Hardware Support**: Optional integration points for external barcode scanners and receipt printers
- **Offline Detection**: Network status monitoring with visual indicators

## Component Architecture
- **Design System**: Consistent component library with theme support and accessibility features
- **Layout Structure**: Responsive grid system with bottom navigation for mobile UX
- **Form Handling**: React Hook Form with Zod validation for type-safe form management
- **Animation System**: Framer Motion for smooth transitions and micro-interactions

## Development Tools
- **Type Safety**: Comprehensive TypeScript configuration with strict type checking
- **Code Quality**: ESLint and Prettier integration for consistent code formatting
- **Development Server**: Hot module replacement with error overlays for rapid development
- **Build Optimization**: Code splitting and tree shaking for minimal bundle sizes

# External Dependencies

## Core Technologies
- **React Ecosystem**: React 18, React DOM, React Router (Wouter), React Query for data management
- **TypeScript**: Full TypeScript implementation with strict type checking
- **Build Tools**: Vite for development and building, esbuild for fast compilation

## UI & Styling
- **Component Library**: Radix UI primitives for accessible, unstyled components
- **Styling**: Tailwind CSS for utility-first styling approach
- **Icons**: Lucide React for consistent icon library
- **Animations**: Framer Motion for smooth animations and transitions

## Database & Storage
- **Client Database**: Dexie.js wrapper for IndexedDB operations
- **ORM**: Drizzle ORM for type-safe database operations
- **Database Driver**: @neondatabase/serverless for PostgreSQL compatibility (development/sync)

## Security & Validation
- **Password Hashing**: bcryptjs for secure password storage
- **Form Validation**: Zod for runtime type validation and schema definition
- **Form Management**: React Hook Form with Hookform Resolvers for integration

## Hardware Integration
- **Barcode Scanning**: @zxing/library for camera-based barcode detection
- **Camera Access**: Native MediaDevices API for video stream handling

## Development & Deployment
- **Development Environment**: Replit-specific plugins for cloud development
- **Session Management**: connect-pg-simple for potential server-side sessions
- **Date Handling**: date-fns for date manipulation and formatting

## Progressive Web App
- **Service Worker**: Custom service worker for offline caching and background sync
- **Manifest**: Web app manifest for installable PWA experience
- **Offline Storage**: Multiple storage strategies for different data types