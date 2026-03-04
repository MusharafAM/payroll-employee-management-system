package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type asgardeoUserInfo struct {
	Sub    string   `json:"sub"`
	Email  string   `json:"email"`
	Groups []string `json:"groups"`
}

var httpClient = &http.Client{Timeout: 10 * time.Second}

// verifyToken calls Asgardeo's OIDC userinfo endpoint with the bearer token.
// This works for both opaque and JWT access tokens — no local JWT parsing needed.
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

// roleFromGroups maps Asgardeo group names → our role constants.
// Priority: ADMIN > MANAGER > EMPLOYEE
func roleFromGroups(groups []string) string {
	for _, g := range groups {
		if strings.ToUpper(g) == "ADMIN" {
			return "ADMIN"
		}
	}
	for _, g := range groups {
		if strings.ToUpper(g) == "MANAGER" {
			return "MANAGER"
		}
	}
	return "EMPLOYEE"
}

// AuthMiddleware validates the Asgardeo access token via the userinfo endpoint
// and sets userEmail, userRole, userSub in the Gin context.
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
			c.Abort()
			return
		}

		info, err := verifyToken(strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			c.Abort()
			return
		}

		c.Set("userEmail", info.Email)
		c.Set("userSub", info.Sub)
		c.Set("userRole", roleFromGroups(info.Groups))
		c.Next()
	}
}

// AdminOnly requires the ADMIN role.
func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("userRole")
		if role != "ADMIN" {
			c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// ManagerOrAdmin requires MANAGER or ADMIN role.
func ManagerOrAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("userRole")
		if role != "ADMIN" && role != "MANAGER" {
			c.JSON(http.StatusForbidden, gin.H{"error": "manager or admin access required"})
			c.Abort()
			return
		}
		c.Next()
	}
}
