class SessionService {
  constructor() {
    this.sessions = new Map(); // userId -> Map(sessionId -> session)
    this.userContexts = new Map(); // userId -> context
  }

  async getOrCreateSession(userId, sessionId = null) {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, new Map());
    }

    const userSessions = this.sessions.get(userId);
    const id = sessionId || this.generateSessionId(userId);
    
    if (!userSessions.has(id)) {
      const session = {
        id,
        userId,
        createdAt: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        context: this.getUserContext(userId) || {},
        status: 'active'
      };
      
      userSessions.set(id, session);
      console.log(`Created new session: ${id} for user: ${userId}`);
    }
    
    const session = userSessions.get(id);
    session.lastActivity = new Date();
    
    return session;
  }

  async updateSession(sessionId, updates) {
    for (const [userId, userSessions] of this.sessions) {
      if (userSessions.has(sessionId)) {
        const session = userSessions.get(sessionId);
        Object.assign(session, updates, {
          lastActivity: new Date()
        });
        return session;
      }
    }
    throw new Error(`Session ${sessionId} not found`);
  }

  async endSession(sessionId) {
    for (const [userId, userSessions] of this.sessions) {
      if (userSessions.has(sessionId)) {
        const session = userSessions.get(sessionId);
        session.status = 'ended';
        session.endedAt = new Date();
        
        // Session cleanup after 1 hour
        setTimeout(() => {
          userSessions.delete(sessionId);
        }, 60 * 60 * 1000);
        
        return session;
      }
    }
    return null;
  }

  async endUserDeviceSessions(userId, deviceId) {
    if (!this.sessions.has(userId)) return;
    
    const userSessions = this.sessions.get(userId);
    for (const [sessionId, session] of userSessions) {
      if (session.deviceId === deviceId) {
        await this.endSession(sessionId);
      }
    }
  }

  async getSessionStatus(sessionId) {
    for (const [userId, userSessions] of this.sessions) {
      if (userSessions.has(sessionId)) {
        const session = userSessions.get(sessionId);
        return {
          exists: true,
          id: session.id,
          userId: session.userId,
          status: session.status,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          messageCount: session.messageCount,
          duration: Date.now() - session.createdAt.getTime()
        };
      }
    }
    return { exists: false };
  }

  getUserContext(userId) {
    return this.userContexts.get(userId) || {};
  }

  async updateUserContext(userId, contextUpdates, merge = true) {
    const currentContext = this.getUserContext(userId);
    
    const newContext = merge 
      ? { ...currentContext, ...contextUpdates }
      : contextUpdates;
    
    this.userContexts.set(userId, newContext);
    
    // Update active sessions with new context
    if (this.sessions.has(userId)) {
      const userSessions = this.sessions.get(userId);
      for (const [sessionId, session] of userSessions) {
        if (session.status === 'active') {
          session.context = { ...session.context, ...contextUpdates };
        }
      }
    }
    
    return newContext;
  }

  async getUserSessions(userId, activeOnly = false) {
    if (!this.sessions.has(userId)) return [];
    
    const userSessions = this.sessions.get(userId);
    const sessions = [];
    
    for (const [sessionId, session] of userSessions) {
      if (!activeOnly || session.status === 'active') {
        sessions.push({
          id: session.id,
          status: session.status,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          messageCount: session.messageCount
        });
      }
    }
    
    return sessions.sort((a, b) => b.lastActivity - a.lastActivity);
  }

  generateSessionId(userId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `session_${userId}_${timestamp}_${random}`;
  }

  // Cleanup inactive sessions (run periodically)
  async cleanupSessions() {
    const now = Date.now();
    const inactiveThreshold = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [sessionId, session] of this.sessions) {
      const inactiveTime = now - session.lastActivity.getTime();
      
      if (inactiveTime > inactiveThreshold) {
        this.sessions.delete(sessionId);
        console.log(`Cleaned up inactive session: ${sessionId}`);
      }
    }
  }

  // Statistics
  getStats() {
    const totalSessions = this.sessions.size;
    const activeSessions = Array.from(this.sessions.values())
      .filter(s => s.status === 'active').length;
    const totalUsers = new Set(Array.from(this.sessions.values())
      .map(s => s.userId)).size;
    
    return {
      totalSessions,
      activeSessions,
      totalUsers,
      averageSessionDuration: this.calculateAverageSessionDuration()
    };
  }

  calculateAverageSessionDuration() {
    const sessions = Array.from(this.sessions.values());
    if (sessions.length === 0) return 0;
    
    const totalDuration = sessions.reduce((sum, session) => {
      const endTime = session.endedAt || new Date();
      return sum + (endTime.getTime() - session.createdAt.getTime());
    }, 0);
    
    return Math.round(totalDuration / sessions.length / 1000); // seconds
  }
}

// Start periodic cleanup
const sessionService = new SessionService();
setInterval(() => {
  sessionService.cleanupSessions();
}, 60 * 60 * 1000); // Run every hour

module.exports = sessionService;
