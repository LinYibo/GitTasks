export default {
  meta: {
    title: 'GitTasks — A local-first, git-backed, markdown todo app',
    description:
      'Capture what needs doing. Your list is a markdown file, and every change becomes a commit. No server, no account, no lock-in.',
  },
  nav: {
    features: 'Features',
    github: 'GitHub repository',
    language: 'Language',
  },
  hero: {
    tagline:
      'Capture what needs doing. Your list is a markdown file, and every change becomes a commit.',
    lead: 'GitTasks is a local-first, git-backed todo app. No server, no account, no sync service — just a file you own and the history you already trust.',
    ctaDownload: 'Download for Windows',
    ctaGithub: 'View on GitHub',
    shotAlt: 'The GitTasks main window: a task list with filters, a composer and a git status bar',
  },
  features: {
    title: 'Built on plain text and git',
    subtitle: 'No database, no cloud, no lock-in — just the tools your work can survive on.',
    items: [
      {
        title: 'Markdown is the database',
        body: 'Your whole list is one tasks.md per repo: checkbox lines with inline metadata. Writes are atomic and always LF, so the file stays diff-friendly forever.',
      },
      {
        title: 'Every change becomes a commit',
        body: 'A moment after you stop typing — or when the window loses focus, or you quit — GitTasks commits. Messages summarize the change, like tasks: +1 ~1 ✓2.',
      },
      {
        title: 'Local-first, zero accounts',
        body: 'No server, no sign-up, nothing to sync. The app works offline and never phones home; your tasks never leave the machine.',
      },
      {
        title: 'Inline metadata syntax',
        body: 'Type #tag, +project, p1 and due:2026-09-20 right in the title. GitTasks renders them as badges for filtering — and keeps them readable in the file.',
      },
      {
        title: 'Stays in sync with your editor',
        body: 'The app watches tasks.md. Edit it in VS Code, a script or sed — the window notices on its own, no reload.',
      },
      {
        title: 'Careful with your git',
        body: 'GitTasks only runs non-destructive commands, writes to just tasks.md, and leaves push and pull to you. History is never rewritten.',
      },
    ],
  },
  footer: {
    license: 'MIT licensed',
    releases: 'Releases',
    github: 'GitHub',
    copyright: '© 2026 GitTasks',
  },
}
