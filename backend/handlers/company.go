package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/musharaf/payroll-backend/database"
	"github.com/musharaf/payroll-backend/models"
)

func GetCompanyProfile(c *gin.Context) {
	var profile models.CompanyProfile
	if err := database.DB.First(&profile).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch company profile"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"profile": profile})
}

func UpdateCompanyProfile(c *gin.Context) {
	var req struct {
		Name       string `json:"name"`
		LogoURL    string `json:"logoUrl"`
		ParserType string `json:"parserType"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var profile models.CompanyProfile
	if err := database.DB.First(&profile).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch company profile"})
		return
	}

	updates := map[string]interface{}{"logo_url": req.LogoURL}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.ParserType != "" {
		updates["parser_type"] = req.ParserType
	}

	if err := database.DB.Model(&profile).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update company profile"})
		return
	}

	database.DB.First(&profile)
	c.JSON(http.StatusOK, gin.H{"profile": profile})
}
