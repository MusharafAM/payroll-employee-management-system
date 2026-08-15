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

	// Personal details
	Phone       string `json:"phone"`
	NIC         string `json:"nic"`
	DateOfBirth string `json:"dateOfBirth"` // stored as YYYY-MM-DD string
	Gender      string `json:"gender"`      // Male | Female | Other

	// Address
	Address string `json:"address"`

	// Employment details
	JoinDate       string `json:"joinDate"`       // YYYY-MM-DD
	EmploymentType string `json:"employmentType"` // Permanent | Contract | Probation | Part-time

	// Emergency contact
	EmergencyContactName         string `json:"emergencyContactName"`
	EmergencyContactPhone        string `json:"emergencyContactPhone"`
	EmergencyContactRelationship string `json:"emergencyContactRelationship"`
	EmergencyContactEmail        string `json:"emergencyContactEmail"`

	// Bank details
	BankName          string `json:"bankName"`
	BankAccountNumber string `json:"bankAccountNumber"`
	BankBranch        string `json:"bankBranch"`

	AnnualLeaveEntitlement int `gorm:"default:14" json:"annualLeaveEntitlement"`

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

	// "hourly" = attendance-driven calculation; "fixed" = baseSalary used directly each month
	SalaryType string `gorm:"default:'hourly'" json:"salaryType"`

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
// Examples: ot_tier1_multiplier=1.5, epf_employee_rate=8.0
type PayrollSettings struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Key         string    `gorm:"uniqueIndex;not null"     json:"key"`
	Value       float64   `gorm:"not null"                 json:"value"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// CompanyProfile holds company-wide identity and configuration (single row).
type CompanyProfile struct {
	ID         uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Name       string    `gorm:"not null;default:'My Company'" json:"name"`
	LogoURL    string    `json:"logoUrl"`
	ParserType string    `gorm:"not null;default:'auto'" json:"parserType"` // auto | podur_xml | ngtimereport
	UpdatedAt  time.Time `json:"updatedAt"`
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

type SalaryAdvance struct {
	ID         string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	EmployeeID string    `gorm:"not null;index"                                  json:"employeeId"`
	Month      string    `gorm:"not null"                                        json:"month"`
	Amount     float64   `gorm:"default:0"                                       json:"amount"`
	Note       string    `json:"note"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type Loan struct {
	ID                 string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	EmployeeID         string    `gorm:"not null;index"                                  json:"employeeId"`
	TotalAmount        float64   `gorm:"default:0"                                       json:"totalAmount"`
	MonthlyInstallment float64   `gorm:"default:0"                                       json:"monthlyInstallment"`
	RemainingBalance   float64   `gorm:"default:0"                                       json:"remainingBalance"`
	StartMonth         string    `gorm:"not null"                                        json:"startMonth"`
	Status             string    `gorm:"default:'active'"                                json:"status"` // active | paid_off
	Note               string    `json:"note"`
	CreatedAt          time.Time `json:"createdAt"`
	UpdatedAt          time.Time `json:"updatedAt"`
}

type LeaveRecord struct {
	ID         string `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	EmployeeID string `gorm:"not null;index"                                  json:"employeeId"`
	Employee   *User  `gorm:"-"                                               json:"employee,omitempty"`

	Date   time.Time `gorm:"not null"  json:"date"`
	Days   float64   `gorm:"default:1" json:"days"`
	Reason string    `json:"reason"`

	// pending | approved | rejected
	// Admin-recorded leaves default to approved; employee requests default to pending.
	Status          string     `gorm:"default:'approved'" json:"status"`
	RejectionReason string     `json:"rejectionReason"`
	ReviewedBy      string     `json:"reviewedBy"`
	ReviewedAt      *time.Time `json:"reviewedAt"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// PublicHoliday represents a company-wide holiday or working holiday.
// IsWorkday=false → excluded from payroll (employees don't work).
// IsWorkday=true  → employees work but are paid at RateMultiplier × hourlyRate.
type PublicHoliday struct {
	ID             string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Date           time.Time `gorm:"not null;uniqueIndex"                           json:"date"`
	Name           string    `gorm:"not null"                                       json:"name"`
	IsWorkday      bool      `gorm:"default:false"                                  json:"isWorkday"`
	RateMultiplier float64   `gorm:"default:1.0"                                    json:"rateMultiplier"`
	Description    string    `json:"description"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// DisciplinaryRecord logs a warning, incident, or formal letter for an employee.
type DisciplinaryRecord struct {
	ID          string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	EmployeeID  string    `gorm:"not null;index"                                  json:"employeeId"`
	Type        string    `gorm:"not null"                                        json:"type"`     // warning | incident | letter
	Severity    string    `gorm:"default:'low'"                                   json:"severity"` // low | medium | high
	Date        string    `gorm:"not null"                                        json:"date"`     // YYYY-MM-DD
	Description string    `json:"description"`
	IssuedBy    string    `json:"issuedBy"` // reviewer email
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// PerformanceReview records a periodic review cycle with ratings and notes.
type PerformanceReview struct {
	ID                  string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	EmployeeID          string    `gorm:"not null;index"                                  json:"employeeId"`
	ReviewPeriod        string    `gorm:"not null"                                        json:"reviewPeriod"`        // e.g. "2025-H1", "2025-Q3", "2025-Annual"
	ReviewDate          string    `gorm:"not null"                                        json:"reviewDate"`          // YYYY-MM-DD
	Rating              string    `gorm:"not null;default:'satisfactory'"                 json:"rating"`              // excellent | good | satisfactory | needs_improvement | unsatisfactory
	Strengths           string    `json:"strengths"`
	AreasForImprovement string    `json:"areasForImprovement"`
	Goals               string    `json:"goals"`
	Notes               string    `json:"notes"`
	ReviewedBy          string    `json:"reviewedBy"` // reviewer email
	Status              string    `gorm:"default:'draft'"                                 json:"status"` // draft | final
	AttendanceScore     float64   `gorm:"default:0"                                       json:"attendanceScore"` // punctuality % (0–100), auto-calculated from attendance data
	CreatedAt           time.Time `json:"createdAt"`
	UpdatedAt           time.Time `json:"updatedAt"`
}

// ExitRecord tracks a resignation or termination with final settlement.
type ExitRecord struct {
	ID         string `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	EmployeeID string `gorm:"not null;index"                                  json:"employeeId"`
	Employee   *User  `gorm:"-"                                               json:"employee,omitempty"`

	ExitType       string `gorm:"not null"          json:"exitType"`       // resignation | termination
	NoticeDate     string `json:"noticeDate"`                               // YYYY-MM-DD
	LastWorkingDay string `json:"lastWorkingDay"`                           // YYYY-MM-DD
	Reason         string `json:"reason"`
	Status         string `gorm:"default:'pending'" json:"status"`          // pending | approved | completed

	// Settlement fields
	LeaveRemainingDays  float64 `gorm:"default:0"     json:"leaveRemainingDays"`
	LeavePayoutElected  bool    `gorm:"default:false" json:"leavePayoutElected"`
	LeavePayoutAmount   float64 `gorm:"default:0"     json:"leavePayoutAmount"`
	OutstandingLoans    float64 `gorm:"default:0"     json:"outstandingLoans"`
	GratuityAmount      float64 `gorm:"default:0"     json:"gratuityAmount"`
	TotalSettlement     float64 `gorm:"default:0"     json:"totalSettlement"`
	Notes               string  `json:"notes"`

	ApprovedBy  string     `json:"approvedBy"`
	ApprovedAt  *time.Time `json:"approvedAt"`
	CompletedAt *time.Time `json:"completedAt"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Payroll struct {
	ID         string `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	EmployeeID string `gorm:"not null"                                       json:"employeeId"`
	Employee   *User  `gorm:"-"                                              json:"employee,omitempty"`
	Month      string `gorm:"not null"                                       json:"month"`

	WorkDays            int     `json:"workDays"`
	RegularHours        float64 `json:"regularHours"`
	OvertimeHours       float64 `json:"overtimeHours"`
	Overtime15Hours     float64 `gorm:"default:0" json:"overtime15Hours"`
	Overtime20Hours     float64 `gorm:"default:0" json:"overtime20Hours"`
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
	HolidayWorkDays      int     `gorm:"default:0" json:"holidayWorkDays"`
	HolidayPay           float64 `gorm:"default:0" json:"holidayPay"`
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
