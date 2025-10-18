# Migration Guide: test-framework → test-suite

## Package Rename

**Old Name:** `@go-corp/test-framework`  
**New Name:** `@go-corp/test-suite`  
**Reason:** Better reflects the package's true nature as a comprehensive testing toolkit rather than a test framework

## What Changed

### ✅ Package Identity
- Package name: `@go-corp/test-framework` → `@go-corp/test-suite`
- Description: Now accurately describes it as a "testing suite"
- Repository: Updated to match new name

### ✅ No Breaking Changes
- All exports remain the same
- All function signatures unchanged
- All TypeScript types unchanged
- All APIs work exactly as before

## Migration Steps

### 1. Update package.json
```diff
{
  "devDependencies": {
-   "@go-corp/test-framework": "^1.0.x",
+   "@go-corp/test-suite": "^1.0.x"
  }
}
```

### 2. Update import statements
```diff
- import { requestJSON, postJSON } from '@go-corp/test-framework'
+ import { requestJSON, postJSON } from '@go-corp/test-suite'

- import type { TestResponse } from '@go-corp/test-framework'
+ import type { TestResponse } from '@go-corp/test-suite'
```

### 3. Install the new package
```bash
# Remove old package
bun remove @go-corp/test-framework

# Install new package
bun add --dev @go-corp/test-suite
```

## What's Next

This rename positions the package for future enhancements inspired by popular testing libraries:

- **Fluent HTTP assertions** (Supertest-style)
- **Advanced factory features** (Factory Bot-style) 
- **Container management** (Testcontainers-style)
- **Enhanced middleware support**

All future development will happen under the `@go-corp/test-suite` name.