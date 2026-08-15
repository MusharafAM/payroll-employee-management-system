package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type TokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

type NameInfo struct {
	GivenName  string `json:"givenName"`
	FamilyName string `json:"familyName"`
}

type Email struct {
	Value   string `json:"value"`
	Primary bool   `json:"primary"`
}

type Wso2Info struct {
	AskPassword string `json:"askPassword"`
}

type ScimUserRequest struct {
	Schemas    []string `json:"schemas"`
	UserName   string   `json:"userName"`
	Name       NameInfo `json:"name"`
	Emails     []Email  `json:"emails"`
	Wso2Schema Wso2Info `json:"urn:scim:wso2:schema"`
}

// getAsgardeoToken authenticates the M2M client to get a bearer token for user management.
func getAsgardeoToken() (string, error) {
	clientID := os.Getenv("ASGARDEO_M2M_CLIENT_ID")
	clientSecret := os.Getenv("ASGARDEO_M2M_CLIENT_SECRET")
	baseURL := os.Getenv("ASGARDEO_BASE_URL")

	if clientID == "" || clientSecret == "" {
		return "", fmt.Errorf("Asgardeo M2M credentials not configured in environment")
	}

	tokenURL := fmt.Sprintf("%s/oauth2/token", baseURL)

	data := url.Values{}
	data.Set("grant_type", "client_credentials")
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("scope", "internal_user_mgt_create")

	req, err := http.NewRequest(http.MethodPost, tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errBuf bytes.Buffer
		errBuf.ReadFrom(resp.Body)
		return "", fmt.Errorf("failed to get token from Asgardeo (status %d): %s", resp.StatusCode, errBuf.String())
	}

	var tokenResp TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", err
	}

	return tokenResp.AccessToken, nil
}

// ProvisionUser sends a user invitation (askPassword: true) to WSO2 Asgardeo via the SCIM 2.0 API.
func ProvisionUser(email, fullName string) error {
	clientID := os.Getenv("ASGARDEO_M2M_CLIENT_ID")
	clientSecret := os.Getenv("ASGARDEO_M2M_CLIENT_SECRET")
	if clientID == "" || clientSecret == "" {
		// Silently skip if not configured in environment (normal for local dev / sandbox)
		fmt.Println("Asgardeo M2M credentials not configured. Skipping user provisioning.")
		return nil
	}

	token, err := getAsgardeoToken()
	if err != nil {
		return fmt.Errorf("failed to authenticate with Asgardeo: %w", err)
	}

	baseURL := os.Getenv("ASGARDEO_BASE_URL")
	usersURL := fmt.Sprintf("%s/scim2/Users", baseURL)

	// Split full name into given and family names
	parts := strings.SplitN(fullName, " ", 2)
	givenName := parts[0]
	familyName := "User"
	if len(parts) > 1 {
		familyName = parts[1]
	}

	reqPayload := ScimUserRequest{
		Schemas: []string{
			"urn:ietf:params:scim:schemas:core:2.0:User",
		},
		UserName: "DEFAULT/" + email,
		Name: NameInfo{
			GivenName:  givenName,
			FamilyName: familyName,
		},
		Emails: []Email{
			{
				Value:   email,
				Primary: true,
			},
		},
		Wso2Schema: Wso2Info{
			AskPassword: "true",
		},
	}

	body, err := json.Marshal(reqPayload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, usersURL, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/scim+json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusConflict {
		// User already exists in Asgardeo — skip creation
		fmt.Printf("User %s already exists in Asgardeo. Skipping creation.\n", email)
		return nil
	}

	if resp.StatusCode != http.StatusCreated {
		var errBuf bytes.Buffer
		errBuf.ReadFrom(resp.Body)
		return fmt.Errorf("failed to create user in Asgardeo (status %d): %s", resp.StatusCode, errBuf.String())
	}

	fmt.Printf("Successfully provisioned user %s in Asgardeo and sent password invitation.\n", email)
	return nil
}
