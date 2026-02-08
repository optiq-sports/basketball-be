# Basketball Management Platform - System Design & Architecture

## 🏗️ Architecture Overview

### **Layered Architecture Pattern**

```
┌─────────────────────────────────────────┐
│         Presentation Layer               │
│  (Controllers, DTOs, Validation)        │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         Business Logic Layer            │
│  (Services, Deduplication, Rules)     │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         Data Access Layer               │
│  (Prisma ORM, Database)                │
└─────────────────────────────────────────┘
```

## 📊 Database Schema Design

### **Core Principles**
1. **Data Integrity First**: All relationships properly constrained
2. **Historical Preservation**: Soft deletes and audit trails
3. **Flexible Associations**: Players can belong to multiple teams
4. **Match-Level Tracking**: Player-team associations per match

### **Key Models**

#### **Player (Independent Entity)**
- Players are standalone entities
- Can play for multiple teams (via PlayerTeam)
- Email uniqueness enforced
- Indexed on firstName, lastName, email for fast lookups

#### **PlayerTeam (Junction Table)**
- Many-to-many relationship: Player ↔ Team
- Tracks jersey number per team
- `isActive` flag for current vs historical associations
- `joinedAt` and `leftAt` for timeline tracking
- Allows players to switch teams while preserving history

#### **MatchPlayer (Match-Level Association)**
- Tracks which player played for which team in a specific match
- Critical for accurate stats when players switch teams mid-season
- Ensures stats are attributed to correct team per match

#### **MatchStat**
- Includes `teamId` to track which team the player was playing for
- Unique constraint: `[matchId, playerId, teamId]`
- Preserves accurate historical statistics

## 🔍 Player Deduplication System

### **Algorithm: Multi-Factor Fuzzy Matching**

```
Similarity Score = Weighted Average of:
├─ First Name (25% weight) - Jaro-Winkler algorithm
├─ Last Name (25% weight) - Jaro-Winkler algorithm  
├─ Email (30% weight) - Exact match or similarity
├─ Height (10% weight) - Normalized inches comparison
├─ Phone (5% weight) - Exact match
└─ Date of Birth (5% weight) - Exact match
```

### **Threshold: 98%**
- Above 98%: Considered duplicate, reuse existing player
- Below 98%: Create new player

### **String Similarity Algorithms**

1. **Levenshtein Distance**: Edit distance between strings
2. **Jaro-Winkler**: Optimized for name matching (prefix bonus)
3. **Normalization**: Case-insensitive, whitespace handling

### **Height Comparison**
- Parses multiple formats: `6'5"`, `6-5`, `77 inches`
- Allows 1-2 inch tolerance
- Falls back to string similarity if parsing fails

## 🔐 Authentication & Authorization

### **Role-Based Access Control (RBAC)**

```
ADMIN
├─ Full CRUD on all entities
├─ Delete operations
└─ User management

STATISTICIAN  
├─ Create/Update: Players, Teams, Tournaments, Matches
├─ Read: All entities
└─ No Delete operations
```

### **JWT Token Flow**
1. User registers/logs in
2. Server generates JWT with role claim
3. Token stored in Session table
4. Subsequent requests include token in Authorization header
5. Guards validate token and check roles

## 🚀 Production-Grade Features

### **1. Error Handling**
- Global exception filter
- Structured error responses
- Proper HTTP status codes
- Error logging with context

### **2. Logging**
- Request/response logging interceptor
- Service-level logging with context
- Error stack traces
- Performance metrics (response time)

### **3. Data Validation**
- DTO validation with class-validator
- Type safety with TypeScript
- Input sanitization
- Whitelist validation

### **4. Transactions**
- Critical operations wrapped in Prisma transactions
- Ensures data consistency
- Rollback on errors

### **5. Response Transformation**
- Consistent response format
- Success/error wrapper
- Timestamp inclusion
- Data transformation layer

## 📈 Performance Optimizations

### **Database**
- Indexed fields: firstName, lastName, email
- Composite indexes for common queries
- Efficient joins with Prisma includes
- Query optimization

### **Caching Strategy** (Future)
- Player deduplication cache
- Team roster cache
- Tournament data cache

### **Batch Operations**
- Bulk player creation with single transaction
- Parallel duplicate checks
- Efficient data processing

## 🔄 Data Flow: Player Creation with Deduplication

```
1. Request: Bulk Create Players for Team
   ↓
2. Validate Team Exists
   ↓
3. Check Jersey Number Conflicts
   ↓
4. For Each Player:
   ├─ Calculate Similarity Score
   ├─ If Score ≥ 98%:
   │  └─ Use Existing Player
   └─ If Score < 98%:
      └─ Create New Player
   ↓
5. Assign Players to Team (Transaction)
   ↓
6. Return Results with Duplicate Report
```

## 🧪 Testing Strategy

### **Unit Tests**
- Service layer logic
- Deduplication algorithms
- Validation rules
- Business logic

### **Integration Tests**
- Database operations
- Transaction handling
- Relationship management

### **E2E Tests**
- Full request/response cycle
- Authentication flow
- CRUD operations
- Error scenarios

## 📝 API Design Principles

### **RESTful Conventions**
- Resource-based URLs
- HTTP methods: GET, POST, PATCH, DELETE
- Status codes: 200, 201, 400, 401, 403, 404, 409, 500

### **Response Format**
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2025-01-15T10:00:00Z"
}
```

### **Error Format**
```json
{
  "statusCode": 400,
  "timestamp": "2025-01-15T10:00:00Z",
  "path": "/api/players",
  "method": "POST",
  "message": "Validation error details"
}
```

## 🔒 Security Considerations

1. **Password Hashing**: bcrypt with salt rounds
2. **JWT Security**: Secret key, expiration
3. **Input Validation**: Prevent injection attacks
4. **CORS**: Configured for frontend domains
5. **Rate Limiting**: (Future implementation)

## 📦 Module Structure

```
src/
├── auth/              # Authentication & Authorization
├── players/          # Player Management
├── teams/            # Team Management  
├── tournaments/      # Tournament Management
├── matches/          # Match Management
├── common/           # Shared utilities
│   ├── services/     # Deduplication service
│   ├── utils/        # String similarity
│   ├── filters/     # Exception filters
│   └── interceptors/ # Logging, transformation
└── prisma/           # Database service
```

## 🎯 Key Design Decisions

### **1. Player-Team Relationship**
**Decision**: Many-to-many via PlayerTeam junction table
**Rationale**: 
- Players can switch teams
- Historical data preservation
- Accurate stats tracking

### **2. MatchPlayer Table**
**Decision**: Separate table for match-level player-team associations
**Rationale**:
- Players may play for different teams in different matches
- Ensures stats accuracy per match
- Supports player transfers mid-season

### **3. Deduplication Threshold**
**Decision**: 98% similarity threshold
**Rationale**:
- High enough to catch true duplicates
- Low enough to avoid false positives
- Weighted scoring accounts for data quality

### **4. Soft Deletes**
**Decision**: Deactivate associations, preserve data
**Rationale**:
- Historical stats must remain accurate
- Audit trail requirements
- Data integrity for reporting

## 🚦 Scalability Considerations

### **Current Capacity**
- Handles thousands of players
- Supports multiple tournaments
- Efficient batch operations

### **Future Enhancements**
- Database sharding for large datasets
- Redis caching layer
- Message queue for async operations
- CDN for file uploads (photos, logos)

## 📊 Monitoring & Observability

### **Logging**
- Request/response logging
- Error tracking
- Performance metrics

### **Future Additions**
- Application Performance Monitoring (APM)
- Error tracking service (Sentry)
- Metrics dashboard
- Health check endpoints

## 🔄 Deployment Strategy

### **Environment Variables**
- `DATABASE_URL`: PostgreSQL connection
- `JWT_SECRET`: Token signing key
- `JWT_EXPIRES_IN`: Token expiration
- `PORT`: Server port

### **Database Migrations**
- Prisma migrations for schema changes
- Version-controlled migrations
- Rollback capability

## ✅ Production Readiness Checklist

- [x] Error handling & logging
- [x] Input validation
- [x] Authentication & authorization
- [x] Database transactions
- [x] Data deduplication
- [x] API documentation (Postman)
- [x] Test suite structure
- [ ] Performance testing
- [ ] Security audit
- [ ] Load testing
- [ ] Monitoring setup

---

**Last Updated**: 2025-01-15
**Version**: 1.0.0
**Status**: Production-Ready (Phase 1)

