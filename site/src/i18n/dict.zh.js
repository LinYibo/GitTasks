export default {
  meta: {
    title: 'GitTasks — 本地优先、以 git 为后端的 markdown 待办应用',
    description:
      '随手记下要做的事。你的清单就是一个 markdown 文件，每次改动都是一个 commit。无需服务器、无需账号、不锁定数据。',
  },
  nav: {
    features: '功能',
    github: 'GitHub 仓库',
    language: '语言',
  },
  hero: {
    tagline: '随手记下要做的事。你的清单就是一个 markdown 文件，每次改动都是一个 commit。',
    lead: 'GitTasks 是一个本地优先、以 git 为后端的待办应用。没有服务器、没有账号、没有同步服务——只有一个属于你的文件，和你本来就信任的历史记录。',
    ctaDownload: '下载 Windows 版',
    ctaGithub: '在 GitHub 上查看',
    shotAlt: 'GitTasks 主窗口：带筛选、输入框和 git 状态栏的任务列表',
  },
  features: {
    title: '建立在纯文本和 git 之上',
    subtitle: '没有数据库、没有云端、不锁定数据——只用经得住时间考验的工具。',
    items: [
      {
        title: 'Markdown 就是数据库',
        body: '整个清单就是每个仓库里的一个 tasks.md：带行内元数据的复选框行。写入是原子的、永远是 LF 换行，文件永远适合 diff。',
      },
      {
        title: '每次改动都是一个 commit',
        body: '停止输入片刻之后——或者窗口失焦、退出应用时——GitTasks 自动提交。提交信息概括这次改动，比如 tasks: +1 ~1 ✓2。',
      },
      {
        title: '本地优先，零账号',
        body: '没有服务器，不用注册，不需要同步。应用可离线使用、从不联网，你的任务永远不会离开这台电脑。',
      },
      {
        title: '行内元数据语法',
        body: '直接在标题里写 #tag、+project、p1、due:2026-09-20。应用把它们渲染成可筛选的徽标——同时在文件里依然保持可读。',
      },
      {
        title: '和你的编辑器保持同步',
        body: '应用会监听 tasks.md。无论你在 VS Code、脚本还是 sed 里修改，窗口都会自动更新，不用刷新。',
      },
      {
        title: '对你的 git 保持克制',
        body: 'GitTasks 只执行非破坏性命令、只写入 tasks.md，push 和 pull 始终由你手动决定。历史记录永不被改写。',
      },
    ],
  },
  footer: {
    license: 'MIT 开源',
    releases: '发布版本',
    github: 'GitHub',
    copyright: '© 2026 GitTasks',
  },
}
