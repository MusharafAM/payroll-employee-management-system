package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/musharaf/payroll-backend/models"
)

type contextKey string

const (
	ContextKeyEmail contextKey = "userEmail"
	ContextKeySub   contextKey = "userSub"
	ContextKeyRole  contextKey = "userRole"
)

type asgardeoUserInfo struct {
	Sub    string   `json:"sub"`
	Email  string   `json:"email"`
	Groups []string `json:"groups"`
}

var httpClient = &http.Client{Timeout: 10 * time.Second}

func verifyToken(tokenStr string) (*asgardeoUserInfo, error) {
	url := os.Getenv("ASGARDEO_BASE_URL") + "/oauth2/userinfo"
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+tokenStr)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("userinfo request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token rejected by Asgardeo (status %d)", resp.StatusCode)
	}

	var info asgardeoUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("userinfo decode failed: %w", err)
	}
	return &info, nil
}

func roleFromGroups(groups []string) models.Role {
	for _, g := range groups {
		switch strings.ToUpper(g) {
		case "ADMIN", "PAYROLL_ADMIN":
			return models.RoleAdmin
		case "MANAGER", "PAYROLL_MANAGER":
			return models.RoleManager
		}
	}
	return models.RoleEmployee
}

// Auth validates the Asgardeo token and injects user info into request context.
func Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "authorization header required"})
			return
		}

		info, err := verifyToken(strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid or expired token"})
			return
		}

		role := roleFromGroups(info.Groups)
		ctx := context.WithValue(r.Context(), ContextKeyEmail, info.Email)
		ctx = context.WithValue(ctx, ContextKeySub, info.Sub)
		ctx = context.WithValue(ctx, ContextKeyRole, string(role))
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// AdminOnly allows only the ADMIN role.
func AdminOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role, _ := r.Context().Value(ContextKeyRole).(string)
		if models.Role(role) != models.RoleAdmin {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "admin access required"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ManagerOrAdmin allows MANAGER or ADMIN roles.
func ManagerOrAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role := models.Role(r.Context().Value(ContextKeyRole).(string))
		if role != models.RoleAdmin && role != models.RoleManager {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "manager or admin access required"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

// CORS adds cross-origin headers for the frontend.
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := os.Getenv("FRONTEND_URL")
		if origin == "" {
			origin = "http://localhost:5173"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
