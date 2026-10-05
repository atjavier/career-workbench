-- The migration runner rebuilds only installed tables with legacy category
-- CHECK constraints, preserving their columns, indexes, triggers and dependents.
-- Fresh databases already have flexible categories. See flexible-clarification-categories.ts.
SELECT 1;
