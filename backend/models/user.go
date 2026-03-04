package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type Role string

const (
	RoleAdmin    Role = "ADMIN"
	RoleManager  Role = "MANAGER"
	RoleEmployee Role = "EMPLOYEE"
)

// JSONBMap is a map[string]float64 stored as PostgreSQL JSONB.
// Used for dynamic/extra allowances on a salary profile.
type JSONBMap map[string]float64

func (j JSONBMap) Value() (driver.Value, error) {
	if j == nil {
		return "{}", nil
	}
	b, err := json.Marshal(j)
	return string(b), err
}

func (j *JSONBMap) Scan(value interface{}) error {
	if value == nil {
		*j = JSONBMap{}
		return nil
	}
	switch v := value.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	}
	return fmt.Errorf("cannot scan type %T into JSONBMap", value)
}

// User holds identity and access fields only.
// Salary/compensation fields live in SalaryProfile.
type User struct {
	ID         string `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	EmployeeID string `gorm:"uniqueIndex;not null"                           json:"employeeId"`
	Email      string `gorm:"uniqueIndex;not null"                           json:"email"`
	Name       string `gorm:"not null"                                       json:"name"`
	Role       Role   `gorm:"default:'EMPLOYEE'"                             json:"role"`
	Department string `json:"department"`
	Position   string `json:"position"`
	IsActive   bool   `gorm:"default:true"                                   json:"isActive"`

	SalaryProfile *SalaryProfile `gorm:"foreignKey:UserID"               json:"salaryProfile,omitempty"`
	Attendance    []Attendance   `gorm:"foreignKey:EmployeeID;references:ID" json:"-"`
	Payroll       []Payroll      `gorm:"foreignKey:EmployeeID;references:ID" json:"-"`

	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// SalaryProfile holds all compensation data for one employee.
// One-to-one with User (UserID is unique).
type SalaryProfile struct {
	ID     string `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	UserID string `gorm:"uniqueIndex;not null"                           json:"userId"`

	HourlyRate          float64 `gorm:"default:0" json:"hourlyRate"`
	BaseSalary          float64 `gorm:"default:0" json:"baseSalary"`
	TravelAllowance     float64 `gorm:"default:0" json:"travelAllowance"`
	TravelAllowanceFixed float64 `gorm:"default:0" json:"travelAllowanceFixed"`
	IncentiveAllowance  float64 `gorm:"default:0" json:"incentiveAllowance"`

	EidBonus        float64 `gorm:"default:0" json:"eidBonus"`
	HajBonus        float64 `gorm:"default:0" json:"hajBonus"`
	PoyaBonus       float64 `gorm:"default:0" json:"poyaBonus"`
	TargetBonus     float64 `gorm:"default:0" json:"targetBonus"`
	AttendanceBonus float64 `gorm:"default:0" json:"attendanceBonus"`

	IsLunchHourDeduction bool     `gorm:"default:true"            json:"isLunchHourDeduction"`
	AdditionalAllowances JSONBMap `gorm:"type:jsonb;default:'{}'" json:"additionalAllowances"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// PayrollSettings holds admin-configurable payroll rules as key-value pairs.
// Examples: overtime_multiplier=1.5, epf_employee_rate=8.0
type PayrollSettings struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Key         string    `gorm:"uniqueIndex;not null"     json:"key"`
	Value       float64   `gorm:"not null"                 json:"value"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type Attendance struct {
	ID            string     `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	EmployeeID    string     `gorm:"not null"                                       json:"employeeId"`
	Date          time.Time  `gorm:"not null"                                       json:"date"`
	TimeIn        *time.Time `json:"timeIn"`
	TimeOut       *time.Time `json:"timeOut"`
	TotalHours    float64    `gorm:"default:0" json:"totalHours"`
	RegularHours  float64    `gorm:"default:0" json:"regularHours"`
	OvertimeHours float64    `gorm:"default:0" json:"overtimeHours"`
	BreakHours    float64    `gorm:"default:0" json:"breakHours"`
	IsHalfDay     bool       `gorm:"default:false" json:"isHalfDay"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

type Payroll struct {
	ID         string `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	EmployeeID string `gorm:"not null"                                       json:"employeeId"`
	Month      string `gorm:"not null"                                       json:"month"`

	WorkDays            int     `json:"workDays"`
	RegularHours        float64 `json:"regularHours"`
	OvertimeHours       float64 `json:"overtimeHours"`
	LunchIncentiveHours float64 `gorm:"default:0" json:"lunchIncentiveHours"`

	BaseSalary           float64 `gorm:"default:0" json:"baseSalary"`
	RegularPay           float64 `gorm:"default:0" json:"regularPay"`
	OvertimePay          float64 `gorm:"default:0" json:"overtimePay"`
	LunchIncentive       float64 `gorm:"default:0" json:"lunchIncentive"`
	PerformanceAllowance float64 `gorm:"default:0" json:"performanceAllowance"`
	TravelAllowance      float64 `gorm:"default:0" json:"travelAllowance"`
	EidBonus             float64 `gorm:"default:0" json:"eidBonus"`
	HajBonus             float64 `gorm:"default:0" json:"hajBonus"`
	PoyaBonus            float64 `gorm:"default:0" json:"poyaBonus"`
	TargetBonus          float64 `gorm:"default:0" json:"targetBonus"`
	AttendanceBonus      float64 `gorm:"default:0" json:"attendanceBonus"`
	OtherBonus           float64 `gorm:"default:0" json:"otherBonus"`
	GrossSalary          float64 `gorm:"default:0" json:"grossSalary"`

	EPF8            float64 `gorm:"default:0" json:"epf8"`
	EPF12           float64 `gorm:"default:0" json:"epf12"`
	ETF3            float64 `gorm:"default:0" json:"etf3"`
	SalaryAdvance   float64 `gorm:"default:0" json:"salaryAdvance"`
	Loan            float64 `gorm:"default:0" json:"loan"`
	TotalDeductions float64 `gorm:"default:0" json:"totalDeductions"`
	NetSalary       float64 `gorm:"default:0" json:"netSalary"`

	PayslipURL  string    `json:"payslipUrl"`
	GeneratedAt time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"generatedAt"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}
