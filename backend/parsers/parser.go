package parsers

import (
	"fmt"

	"gorm.io/gorm"
)

// AttendanceParser is the interface that every company-specific biometric parser must implement.
type AttendanceParser interface {
	Name() string
	Description() string
	// Supports returns true if the parser detects its format signature in the Excel rows
	Supports(rows [][]string) bool
	// Parse processes the rows and writes attendance entries to the database
	Parse(rows [][]string, db *gorm.DB) (saved int, skipped int, errs []string)
}

var registry = make(map[string]AttendanceParser)

// Register adds a new parser plugin to the system
func Register(p AttendanceParser) {
	registry[p.Name()] = p
}

// Get retrieves a parser by its identifier
func Get(name string) (AttendanceParser, error) {
	p, ok := registry[name]
	if !ok {
		return nil, fmt.Errorf("parser format %q not found", name)
	}
	return p, nil
}

// Detect scans the rows to auto-detect a compatible parser format
func Detect(rows [][]string) (AttendanceParser, error) {
	for _, p := range registry {
		if p.Supports(rows) {
			return p, nil
		}
	}
	return nil, fmt.Errorf("could not auto-detect attendance file format")
}

// ListAvailable returns all registered formats
func ListAvailable() []map[string]string {
	list := []map[string]string{}
	for name, p := range registry {
		list = append(list, map[string]string{
			"name":        name,
			"description": p.Description(),
		})
	}
	return list
}
