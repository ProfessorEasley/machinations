# Machinations Frontend

A React-based frontend application for the Machinations project.

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

```bash
npm install
```

## 🛠️ Development Tools

This project includes:

- **ESLint**: Code linting with TypeScript and React support
- **Prettier**: Code formatting
- **Husky**: Git hooks for pre-commit checks
- **lint-staged**: Run linters on staged files

## 📝 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format code with Prettier
npm run format:check # Check Prettier formatting
```

## 🌿 Branch Strategy

### Branch Structure

- **`main`**: Production-ready code
- **`staging`**: Pre-production testing
- **`development`**: Integration and testing

### Development Workflow

1. **Create a feature branch** from `development`:

   ```bash
   git checkout development
   git pull origin development
   git checkout -b feature/your-feature-name
   ```

2. **Work on your feature** and commit regularly:

   ```bash
   git add .
   git commit -m "feat: add new component"
   ```

3. **Push your feature branch**:

   ```bash
   git push origin feature/your-feature-name
   ```

4. **Create a Pull Request** to merge into `development`

5. **Wait for:**
   - ✅ 2 code reviews
   - ✅ All CI checks to pass (linting, type checking, build)

6. **Merge when approved**

### Branch Protection Rules

#### Protected Branches (require 2 reviewers):

- `main`
- `development`
- `staging`

#### Required Status Checks:

- `lint-and-format`
- `type-check`
- `build`

### Branch Naming Convention

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

## 🔒 Git Hooks

Husky is configured with the following hooks:

- **pre-commit**: Runs lint-staged (ESLint + Prettier)

## 🔧 Configuration Files

- `eslint.config.js` - ESLint configuration
- `.prettierrc` - Prettier configuration
- `.github/workflows/ci.yml` - GitHub Actions CI/CD pipeline

## 📁 Project Structure

```
src/
├── components/          # React components
├── pages/              # Page components
├── routes/             # Routing configuration
├── store/              # State management
├── styles/             # Global styles
├── types/              # TypeScript types
├── utils/              # Utility functions

.github/
└── workflows/          # GitHub Actions
```

## 🚨 Troubleshooting

1. **ESLint errors**: Run `npm run lint:fix`
2. **Prettier formatting**: Run `npm run format`
3. **TypeScript errors**: Run `npx tsc --noEmit`

## 📋 Important Notes

- **Never push directly** to `main`, `development`, or `staging`
- **Always create pull requests** for code reviews
- **Delete feature branches** after merging
- **Keep branches up to date** with the target branch
- **Husky will automatically run linting/formatting** on commit - you don't need to run them manually for every commit

## 🚀 CI/CD Pipeline

The GitHub Actions workflow includes:

1. **Lint and Format Check** - Ensures code quality
2. **TypeScript Type Check** - Ensures type safety
3. **Build** - Creates production build

### When CI Runs:

- On every push to `main`, `development`, `staging`
- On every pull request to these branches

## 📚 Additional Resources

- [ESLint Documentation](https://eslint.org/docs/latest/)
- [Prettier Documentation](https://prettier.io/docs/en/index.html)
- [Husky Documentation](https://typicode.github.io/husky/)
