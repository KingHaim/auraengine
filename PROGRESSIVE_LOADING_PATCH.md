# Progressive Image Loading Patch

## Problem
Users wait 2:40 seeing nothing, then all images appear at once.

## Solution
Save each image immediately after generation + show in UI as they arrive.

## Files to modify:
1. `apps/api/main_simple.py` - Save progress after each image
2. `apps/web/app/campaigns/page.tsx` - Display images progressively

## Changes applied below
