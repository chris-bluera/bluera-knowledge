#!/usr/bin/env bash
#
# validate-npm-release.sh
#
# Post-release validation script for bluera-knowledge npm module.
# Installs the latest version from npm and exercises all CLI commands.
#
# Usage:
#   ./scripts/validate-npm-release.sh
#
# Output:
#   Logs written to: <repo>/logs/validation/npm-validation-YYYYMMDD-HHMMSS.log
#   Exit code: 0 if all tests pass, 1 if any fail
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$REPO_ROOT/logs/validation"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$RESULTS_DIR/npm-validation-$TIMESTAMP.log"

# Test configuration
TEST_STORE="npm-validation-test-$TIMESTAMP"
TEST_FOLDER="$(mktemp -d)"
DATA_DIR="$(mktemp -d)"

# Counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Setup
mkdir -p "$RESULTS_DIR"
echo "Test content for validation" > "$TEST_FOLDER/test.txt"
echo "Another test file" > "$TEST_FOLDER/test2.md"

# Logging functions
log() {
    echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG_FILE"
}

log_header() {
    echo "" | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
    echo "$*" | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
}

pass() {
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log "✓ PASS: $*"
}

fail() {
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log "✗ FAIL: $*"
}

# Run a command and check exit code
run_test() {
    local name="$1"
    shift
    local cmd="$*"

    log "Running: $cmd"
    if eval "$cmd" 2>&1 | tee -a "$LOG_FILE"; then
        pass "$name"
        return 0
    else
        fail "$name (exit code: ${PIPESTATUS[0]})"
        return 1
    fi
}

# Run a command and check output contains expected string
run_test_contains() {
    local name="$1"
    local expected="$2"
    shift 2
    local cmd="$*"

    log "Running: $cmd"
    local output
    # Capture output while also showing it on terminal via tee
    if output=$(eval "$cmd" 2>&1 | tee -a "$LOG_FILE"); then
        if echo "$output" | grep -q "$expected"; then
            pass "$name"
            return 0
        else
            fail "$name (output missing: $expected)"
            return 1
        fi
    else
        fail "$name (command failed)"
        return 1
    fi
}

# Cleanup function
cleanup() {
    log_header "Cleanup"

    # Delete test store if it exists
    log "Deleting test store: $TEST_STORE"
    bluera-knowledge store delete "$TEST_STORE" --force -d "$DATA_DIR" 2>/dev/null || true

    # Remove test folder
    log "Removing test folder: $TEST_FOLDER"
    rm -rf "$TEST_FOLDER"

    # Remove data directory
    log "Removing data directory: $DATA_DIR"
    rm -rf "$DATA_DIR"

    log "Cleanup complete"
}

# Set trap for cleanup on exit
trap cleanup EXIT

# Start validation
log_header "NPM Module Validation - $TIMESTAMP"
log "Log file: $LOG_FILE"
log "Test store: $TEST_STORE"
log "Test folder: $TEST_FOLDER"
log "Data directory: $DATA_DIR"

# Install latest from npm
log_header "Installing Latest from npm"
log "Installing bluera-knowledge@latest globally..."
if npm install -g bluera-knowledge@latest >> "$LOG_FILE" 2>&1; then
    pass "npm install -g bluera-knowledge@latest"
else
    fail "npm install -g bluera-knowledge@latest"
    log "ERROR: Failed to install package. Aborting."
    exit 1
fi

# Verify installation
log_header "Verifying Installation"

run_test_contains "bluera-knowledge --version" "0." "bluera-knowledge --version"

run_test_contains "bluera-knowledge --help" "CLI tool for managing knowledge stores" "bluera-knowledge --help"

# Test stores list (should work even if empty)
log_header "Testing Store Operations"

run_test "bluera-knowledge stores (initial list)" "bluera-knowledge stores -d '$DATA_DIR' -f json"

# Create a store via add-folder
log_header "Testing add-folder"

run_test "bluera-knowledge add-folder" "bluera-knowledge add-folder '$TEST_FOLDER' --name '$TEST_STORE' -d '$DATA_DIR'"

# Verify store was created
run_test_contains "Store appears in list" "$TEST_STORE" "bluera-knowledge stores -d '$DATA_DIR'"

# Test store info
log_header "Testing store info"

run_test_contains "bluera-knowledge store info" "$TEST_STORE" "bluera-knowledge store info '$TEST_STORE' -d '$DATA_DIR'"

# Test search (may return no results, but should not error)
log_header "Testing search"

run_test "bluera-knowledge search" "bluera-knowledge search 'test content' --store '$TEST_STORE' -d '$DATA_DIR' -f json"

# Test index command (re-index)
log_header "Testing index"

run_test "bluera-knowledge index" "bluera-knowledge index '$TEST_STORE' -d '$DATA_DIR'"

# Test search again after re-indexing
run_test "bluera-knowledge search (after reindex)" "bluera-knowledge search 'validation' --store '$TEST_STORE' -d '$DATA_DIR' -f json"

# Test store delete
log_header "Testing store delete"

run_test "bluera-knowledge store delete" "bluera-knowledge store delete '$TEST_STORE' --force -d '$DATA_DIR'"

# Verify store was deleted
log "Verifying store was deleted..."
if bluera-knowledge stores -d "$DATA_DIR" -f json 2>&1 | grep -q "$TEST_STORE"; then
    fail "Store still exists after delete"
else
    pass "Store successfully deleted"
fi

# Summary
log_header "Validation Summary"
log "Tests run:    $TESTS_RUN"
log "Tests passed: $TESTS_PASSED"
log "Tests failed: $TESTS_FAILED"
log ""
log "Log file: $LOG_FILE"

if [ "$TESTS_FAILED" -gt 0 ]; then
    log "VALIDATION FAILED"
    exit 1
else
    log "VALIDATION PASSED"
    exit 0
fi
