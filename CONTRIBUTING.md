# Contributing to Active Directory Sync

Thank you for your interest in contributing to **Active Directory Sync**! We welcome and appreciate contributions from the community to help make this project better.

Please take a moment to review this document before submitting your pull requests.

---

## 🚀 How to Set Up the Project Locally

To get started, follow these steps to clone the repository and launch the application on your local machine:

1. **Clone the Repository**
   ```bash
   git clone https://github.com/ntuan2502/next-activedirectory-base.git
   cd next-activedirectory-base
   ```

2. **Install Dependencies**
   Make sure you have [pnpm](https://pnpm.io/) installed.
   ```bash
   pnpm install
   ```

3. **Configure the Environment**
   Copy `.env.example` to `.env` and fill in the database configuration variables:
   ```bash
   cp .env.example .env
   ```

4. **Spin up PostgreSQL via Docker**
   ```bash
   docker compose up -d
   ```

5. **Sync Prisma Schema**
   ```bash
   pnpm prisma db push
   ```

6. **Start the Development Server**
   ```bash
   pnpm dev
   ```

---

## 🛠️ Recommended Development Workflow

To ensure code quality and consistency across contributions, we recommend following this workflow:

1. **Create a Branch**
   Always create a descriptive branch for your work:
   - Feature branch: `feat/your-feature-name`
   - Bug fix branch: `fix/bug-description`
   - Documentation branch: `docs/documentation-topic`

2. **Develop and Write Code**
   Implement your changes, keeping them clean, focused, and well-structured.

3. **Verify Your Changes**
   Before submitting your PR, make sure your code passes linting and TypeScript checks locally:
   
   - **Code Linting**
     ```bash
     pnpm lint
     ```
   
   - **TypeScript Type Verification**
     ```bash
     pnpm tsc --noEmit
     ```

4. **Commit Your Changes**
   We enforce **Conventional Commits** for all commit messages. (See details below).

5. **Push and Submit a Pull Request**
   Push your branch to your fork and submit a PR to the `main` branch. Provide a clear description of the changes, their purpose, and how you verified them.

---

## 📝 Commit Message Guidelines (Conventional Commits)

Your commit messages must follow the **Conventional Commits** specification. This allows automatic changelog generation and easier repository history navigation.

The format should look like this:
```plaintext
<type>(<scope>): <short summary>

[optional body describing details]
```

### Supported Commit Types

- **`feat`**: A new feature for the user (e.g., `feat(auth): add password recovery option`).
- **`fix`**: A bug fix for the user (e.g., `fix(ldap): resolve connection timeout on slow servers`).
- **`docs`**: Documentation-only changes (e.g., `docs(readme): add installation guide for Bun`).
- **`style`**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.).
- **`refactor`**: A code change that neither fixes a bug nor adds a feature (e.g., `refactor(session): simplify session termination routing`).
- **`test`**: Adding missing tests or correcting existing tests (e.g., `test(auth): add integration tests for LDAP auth`).
- **`chore`**: Changes to the build process, auxiliary tools, or libraries (e.g., `chore(deps): upgrade prisma to latest v7`).

---

## 💬 Questions or Need Help?

If you have any questions or encounter issues, please feel free to open an Issue on GitHub or reach out to the project maintainers.
