/**
 * Go Workflow Configuration for Test Framework
 */
export default {
  // Project information
  name: '@go-corp/test-framework',
  repository: 'https://github.com/go-corp/test-framework',
  defaultBranch: 'main',

  // Pre/post release commands
  commands: {
    preRelease: [
      'npm run clean',
      'npm run build',
      'npm run typecheck',
      'npm run lint'
    ],
    postRelease: [],
  },

  // GitHub integration
  github: {
    autoRelease: true,
    autoMerge: false, // Manual review for test framework
    labels: ['enhancement', 'testing', 'framework'],
  },

  // NPM publishing
  npm: {
    registry: 'https://registry.npmjs.org',
    access: 'public',
    autoPublish: false, // Manual control for framework releases
    tag: 'latest',
  },

  // Git configuration
  git: {
    tagPrefix: 'v',
    pushTags: true,
    requireCleanWorkingDirectory: true,
  },

  // Changelog configuration
  changelog: {
    path: 'CHANGELOG.md',
    includeTypes: ['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'build'],
    excludeTypes: ['chore', 'style'],
    sections: [
      {
        title: '🚀 Features',
        types: ['feat']
      },
      {
        title: '🐛 Bug Fixes', 
        types: ['fix']
      },
      {
        title: '⚡ Performance',
        types: ['perf']
      },
      {
        title: '🔧 Refactoring',
        types: ['refactor']
      },
      {
        title: '📚 Documentation',
        types: ['docs']
      },
      {
        title: '🧪 Testing',
        types: ['test']
      },
      {
        title: '🏗️ Build System',
        types: ['build']
      }
    ],
  },

  // Deployment targets (optional - add if you have deployment needs)
  deployments: [
    // Example for npm publishing (you can uncomment and modify if needed)
    // {
    //   target: 'npm',
    //   name: 'NPM Registry',
    //   command: 'npm publish --access public',
    //   preCommand: 'npm run build',
    //   confirmRequired: true,
    //   env: {
    //     NODE_ENV: 'production'
    //   }
    // }
  ],
}