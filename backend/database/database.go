package database

import (
	"log"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/musharaf/payroll-backend/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL not set in .env file")
	}

	// Parse the DSN and force simple query protocol.
	// Required for Supabase PgBouncer (transaction mode, port 6543)
	// which does not support prepared statements.
	connConfig, err := pgx.ParseConfig(dsn)
	if err != nil {
		log.Fatal("Failed to parse DATABASE_URL:", err)
	}
	connConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	sqlDB := stdlib.OpenDB(*connConfig)

	DB, err = gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	log.Println("✅ Database connected successfully")
}

func Migrate() {
	err := DB.AutoMigrate(
		&models.User{},
		&models.SalaryProfile{},
		&models.PayrollSettings{},
		&models.CompanyProfile{},
		&models.Attendance{},
		&models.Payroll{},
		&models.SalaryAdvance{},
		&models.Loan{},
		&models.LeaveRecord{},
		&models.PublicHoliday{},
		&models.DisciplinaryRecord{},
		&models.ExitRecord{},
		&models.PerformanceReview{},
	)
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}
	log.Println("✅ Database migrated successfully")

	seedPayrollSettings()
	seedCompanyProfile()
}

// seedPayrollSettings inserts default admin-configurable payroll rules.
// Uses FirstOrCreate so existing custom values are never overwritten.
func seedPayrollSettings() {
	defaults := []models.PayrollSettings{
		{Key: "epf_employee_rate", Value: 8.0, Description: "Employee EPF contribution (%)"},
		{Key: "epf_employer_rate", Value: 12.0, Description: "Employer EPF contribution (%)"},
		{Key: "etf_rate", Value: 3.0, Description: "ETF contribution rate (%)"},
		{Key: "regular_hours_per_day", Value: 8.0, Description: "Standard daily regular hours before overtime begins"},
		{Key: "lunch_hour_offset", Value: 1.0, Description: "Extra hours added to OT threshold when lunch deduction is active"},
		{Key: "ot_tier1_multiplier", Value: 1.5, Description: "First-tier overtime pay multiplier (e.g. 1.5 = time-and-a-half)"},
		{Key: "ot_tier2_multiplier", Value: 2.0, Description: "Second-tier overtime pay multiplier (e.g. 2.0 = double time)"},
		{Key: "ot_tier1_window_hours", Value: 2.0, Description: "Hours of first-tier OT before second tier kicks in"},
		{Key: "lunch_incentive_per_day", Value: 0.5, Description: "Lunch incentive hours credited per worked day (when lunch deduction is active)"},
		{Key: "round_to_nearest", Value: 10.0, Description: "Round all salary components up to this value (e.g. 10 = nearest LKR 10, 1 = no rounding)"},
		{Key: "shift_start_minutes", Value: 480.0, Description: "Expected shift start time in minutes since midnight (e.g. 480 = 08:00, 510 = 08:30). Used to calculate punctuality in performance reviews."},
	}

	for _, s := range defaults {
		DB.Where(models.PayrollSettings{Key: s.Key}).FirstOrCreate(&s)
	}
	log.Println("✅ Payroll settings seeded")
}

// seedCompanyProfile creates the default company profile row if it doesn't exist.
func seedCompanyProfile() {
	var count int64
	DB.Model(&models.CompanyProfile{}).Count(&count)
	if count == 0 {
		DB.Create(&models.CompanyProfile{Name: "My Company", ParserType: "auto"})
	}
	log.Println("✅ Company profile seeded")
}
