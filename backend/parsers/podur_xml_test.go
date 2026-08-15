package parsers

import (
	"os"
	"strings"
	"testing"
)

func TestParseXMLSpreadsheet(t *testing.T) {
	// Read the actual XLS file from root
	data, err := os.ReadFile("../../20260601-20260614.XLS")
	if err != nil {
		t.Fatalf("failed to read test XLS file: %v", err)
	}

	rows, err := ParseXMLSpreadsheet(data)
	if err != nil {
		t.Fatalf("ParseXMLSpreadsheet failed: %v", err)
	}

	if len(rows) == 0 {
		t.Fatalf("expected rows, got 0")
	}

	// Verify first row contains Time Card Report
	foundReport := false
	for _, col := range rows[0] {
		if strings.Contains(strings.ToLower(col), "time card report") {
			foundReport = true
			break
		}
	}
	if !foundReport {
		t.Errorf("expected Time Card Report in first row, got: %v", rows[0])
	}

	// Find Sabrin header row
	foundSabrin := false
	for _, r := range rows {
		if len(r) > 0 && r[0] == "ID:1" {
			foundSabrin = true
			// Check name is Sabrin
			if len(r) > 2 && !strings.Contains(r[2], "Sabrin") {
				t.Errorf("expected name Sabrin, got %q", r[2])
			}
			// Check date is Date:06/01/2026-06/14/2026
			if len(r) > 8 && !strings.Contains(r[8], "Date:06/01/2026-06/14/2026") {
				t.Errorf("expected date range, got %q", r[8])
			}
		}
	}
	if !foundSabrin {
		t.Errorf("could not find Sabrin (ID:1) in rows")
	}
}
