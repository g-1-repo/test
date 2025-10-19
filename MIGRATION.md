# Migration Guide: test-framework → test-suite

## Package Rename

**Old Name:** `@go-corp/test-framework`  
**New Name:** `@g-1/test`  
**Reason:** Reflects the new G1 brand and scope while keeping the package identity as a comprehensive testing suite

## What Changed

### ✅ Package Identity
- Package name: `@go-corp/test-framework` → `@g-1/test`
- Description: Now accurately describes it as a "testing suite"
- Repository: Updated to match new name and organization scope (G1)

### ✅ No Breaking Changes
- All exports remain the same
- All function signatures unchanged
- All TypeScript types unchanged
- All APIs work exactly as before (package scope changed only)

## Migration Steps

### 1. Update package.json
```diff
{
  "devDependencies": {
-   "@go-corp/test-framework": "^1.0.x",
+   "@g-1/test": "^1.0.x"
  }
}
```

### 2. Update import statements
```diff
- import { requestJSON, postJSON } from '@go-corp/test-framework'
+ import { requestJSON, postJSON } from '@g-1/test'

- import type { TestResponse } from '@go-corp/test-framework'
+ import type { TestResponse } from '@g-1/test'
```

### 3. Install the new package
```bash
# Remove old package
bun remove @go-corp/test-framework

# Install new package
bun add --dev @g-1/test
```

## What's Next

This rename positions the package for future enhancements inspired by popular testing libraries:

- **Fluent HTTP assertions** (Supertest-style)
- **Advanced factory features** (Factory Bot-style) 
- **Container management** (Testcontainers-style)
- **Enhanced middleware support**

All future development will happen under the `@go-corp/test-suite` name.