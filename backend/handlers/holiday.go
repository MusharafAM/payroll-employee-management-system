package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/musharaf/payroll-backend/database"
	"github.com/musharaf/payroll-backend/models"
	"gorm.io/gorm"
)

func ListHolidays(c *gin.Context) {
	year := c.Query("year")
	query := database.DB.Order("date asc")
	if year != "" {
		t, err := time.Parse("2006", year)
		if err == nil {
			query = query.Where("date >= ? AND date < ?", t, t.AddDate(1, 0, 0))
		}
	}
	var holidays []models.PublicHoliday
	if err := query.Find(&holidays).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch holidays"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"holidays": holidays})
}

func CreateHoliday(c *gin.Context) {
	var req struct {
		Date           string  `json:"date" binding:"required"`
		Name           string  `json:"name" binding:"required"`
		IsWorkday      bool    `json:"isWorkday"`
		RateMultiplier float64 `json:"rateMultiplier"`
		Description    string  `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format (use YYYY-MM-DD)"})
		return
	}
	if req.IsWorkday && req.RateMultiplier <= 0 {
		req.RateMultiplier = 1.0
	}
	holiday := models.PublicHoliday{
		Date:           date,
		Name:           req.Name,
		IsWorkday:      req.IsWorkday,
		RateMultiplier: req.RateMultiplier,
		Description:    req.Description,
	}
	if err := database.DB.Create(&holiday).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create holiday: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"holiday": holiday})
}

func UpdateHoliday(c *gin.Context) {
	id := c.Param("id")
	var holiday models.PublicHoliday
	if err := database.DB.First(&holiday, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "holiday not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch holiday"})
		return
	}

	var req struct {
		Date           string  `json:"date"`
		Name           string  `json:"name"`
		IsWorkday      bool    `json:"isWorkday"`
		RateMultiplier float64 `json:"rateMultiplier"`
		Description    string  `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Date != "" {
		date, err := time.Parse("2006-01-02", req.Date)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format (use YYYY-MM-DD)"})
			return
		}
		holiday.Date = date
	}
	if req.Name != "" {
		holiday.Name = req.Name
	}
	holiday.IsWorkday = req.IsWorkday
	holiday.RateMultiplier = req.RateMultiplier
	holiday.Description = req.Description

	if err := database.DB.Save(&holiday).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update holiday"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"holiday": holiday})
}

func DeleteHoliday(c *gin.Context) {
	id := c.Param("id")
	result := database.DB.Delete(&models.PublicHoliday{}, "id = ?", id)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete holiday"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "holiday not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "holiday deleted"})
}
