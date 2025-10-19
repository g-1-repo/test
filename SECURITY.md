# Security Policy

## Supported Versions

We actively maintain and provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✅ Yes             |

## Reporting a Vulnerability

If you discover a security vulnerability in @g-1/test, please report it responsibly:

### 🔒 Private Disclosure

1. **Do not** create a public GitHub issue for security vulnerabilities
2. Email us directly at: **security@golive.me**
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact assessment
   - Any suggested fixes (if available)

### 📋 Response Process

1. **Acknowledgment**: We'll acknowledge receipt within 24 hours
2. **Investigation**: We'll investigate and assess the vulnerability within 72 hours
3. **Fix**: We'll work on a fix and coordinate disclosure timing
4. **Release**: We'll release a security update and publicly disclose the issue

### 🏆 Recognition

We appreciate security researchers who help keep our users safe. With your permission, we'll:
- Credit you in the security advisory
- Include you in our security contributors list
- Provide a public thank you (if desired)

## Security Best Practices

When using @g-1/test:

### ✅ Recommended
- Always use the latest stable version
- Regularly update dependencies
- Use the framework only in test environments
- Review and audit any custom test utilities you create
- Keep sensitive test data separate from test code

### ❌ Avoid
- Using the framework in production environments
- Including real API keys or credentials in test code
- Running tests with production databases
- Executing untrusted test code
- Sharing test environments with sensitive data

## Dependencies

We regularly audit our dependencies for security vulnerabilities using:
- npm audit
- GitHub Dependabot alerts  
- Automated security scanning

## Testing Security

The test framework itself undergoes security testing:
- Static code analysis
- Dependency vulnerability scanning
- Regular security audits
- Safe handling of test data and credentials

---

Thank you for helping keep @g-1/test and our community safe! 🛡️
