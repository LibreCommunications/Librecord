#!/usr/bin/env bash

set -u

PROJECT_INFRA="Librecord.Infra/Librecord.Infra.csproj"
PROJECT_API="Librecord.Api/Librecord.Api.csproj"
CONTEXT="Librecord.Infra.Database.LibrecordContext"
CONFIG="Debug"
MIGRATIONS_DIR="Migrations"

APPLY_ONLY=false

# -----------------------------
# ARGUMENT PARSING
# -----------------------------
for arg in "$@"; do
    case "$arg" in
        --apply-only)
            APPLY_ONLY=true
            shift
            ;;
        *)
            echo "Unknown option: $arg"
            exit 1
            ;;
    esac
done

echo "----------------------------------------"
echo " EF Core Migration Helper"
echo "----------------------------------------"
echo

# -----------------------------
# ADD MIGRATION (OPTIONAL)
# -----------------------------
if [ "$APPLY_ONLY" = false ]; then
    read -rp "Enter migration name (or leave empty to skip scaffolding): " MIGRATION_NAME
    echo

    if [ -n "$MIGRATION_NAME" ]; then
        echo "Scaffolding migration: $MIGRATION_NAME"
        echo

        if ! dotnet ef migrations add "$MIGRATION_NAME" \
            --project "$PROJECT_INFRA" \
            --startup-project "$PROJECT_API" \
            --context "$CONTEXT" \
            --configuration "$CONFIG" \
            --output-dir "$MIGRATIONS_DIR"; then

            echo
            echo "Migration scaffolding failed."
            echo
            echo "Possible reasons:"
            echo " - Migration already exists"
            echo " - Model is non-deterministic"
            echo " - Build failed"
            echo

            read -rp "Continue to database update anyway? (y/N): " CONTINUE

            if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
                echo "Aborting."
                exit 1
            fi
        fi
    else
        echo "Skipping migration scaffolding."
    fi
else
    echo "Apply-only mode enabled — skipping migration scaffolding."
fi

echo
echo "----------------------------------------"
echo " Updating database"
echo "----------------------------------------"
echo

# -----------------------------
# DATABASE UPDATE
# -----------------------------
if ! dotnet ef database update \
    --project "$PROJECT_INFRA" \
    --startup-project "$PROJECT_API" \
    --context "$CONTEXT" \
    --configuration "$CONFIG"; then

    echo
    echo "Database update failed."
    echo
    echo "Common causes:"
    echo " - Migration contains destructive changes"
    echo " - Database is out of sync"
    echo " - Connection string is invalid"
    echo

    read -rp "Do you want to try dropping and recreating the database? (DEV ONLY) (y/N): " DROP

    if [[ "$DROP" =~ ^[Yy]$ ]]; then
        echo
        echo "Dropping database..."
        if ! dotnet ef database drop \
            --force \
            --project "$PROJECT_INFRA" \
            --startup-project "$PROJECT_API" \
            --context "$CONTEXT" \
            --configuration "$CONFIG"; then
            echo "Database drop failed."
            exit 1
        fi

        echo
        echo "Recreating database..."
        dotnet ef database update \
            --project "$PROJECT_INFRA" \
            --startup-project "$PROJECT_API" \
            --context "$CONTEXT" \
            --configuration "$CONFIG"
    else
        echo "Aborting."
        exit 1
    fi
fi

echo
echo "----------------------------------------"
echo " Database is up to date"
echo "----------------------------------------"
