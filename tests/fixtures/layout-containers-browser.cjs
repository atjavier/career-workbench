// Run from the project root: node_modules/.bin/electron tests/fixtures/layout-containers-browser.cjs
// Uses real primitives and global CSS in Chromium; no private workspace data is loaded.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const assert = require('node:assert/strict');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 900,
    webPreferences: { contextIsolation: true, nodeIntegration: false } });
  try {
    if (process.env.OPPORTUNITY_PAGE_URL) throw new Error('The creation flow changed. Use opportunity-draft-browser.cjs with DRAFT_PAGE_URL and DRAFT_TEST_ROOT for live draft/review/save verification.');
    const css = fs.readFileSync(process.cwd() + '/src/app/globals.css', 'utf8');
    require('tsx/cjs');
    const { createElement: h } = require('react');
    const { renderToStaticMarkup } = require('react-dom/server');
    const { WorkspaceContainer, ContentCard } = require('../../src/components/common/layout-containers.tsx');
    const { WorkspaceSidebar } = require('../../src/components/common/workspace-sidebar.tsx');
    const sidebar = renderToStaticMarkup(h(WorkspaceSidebar, { destinations: [
      { href: '/', label: 'Jobs', description: 'Jobs', icon: h('span', null, 'J'), subItems: [{ href: '/', label: 'All Opportunities', description: 'All Opportunities' }, { href: '/applications', label: 'Applied', description: 'Applied' }] },
      { href: '/resume', label: 'Resume', description: 'Resume', icon: h('span', null, 'R'), subItems: [
        { href: '/resume/profile', label: 'Your Details', description: 'Your Details' },
        { href: '/evidence', label: 'Experience & Projects', description: 'Experience & Projects' },
        { href: '/resume/interview', label: 'Coach Q&A', description: 'Coach Q&A' },
        { href: '/resume', label: 'Resume Preview', description: 'Resume Preview' },
      ] },
      { href: '/settings', label: 'Settings', description: 'Settings', icon: h('span', null, 'S') },
    ], activeSection: 'Resume', activeSubItem: 'Your Details' }));
    const { Button } = require('../../src/components/common/button.tsx');
    const pageClasses = ['jobs-page-shell', 'resume-profile-workspace', 'resume-workspace experience-projects-workspace', 'evidence-details-workspace', 'resume-workspace resume-onboarding-workspace'];
    const cardClasses = ['job-listing', 'resume-profile-card', 'experience-project-row'];
    const page = pageClasses.map((className, i) => renderToStaticMarkup(h(WorkspaceContainer, { className, id: `page-${i}` },
      h('h1', null, 'Layout check'),
      ...cardClasses.map((className, j) => h(ContentCard, { className, key: j },
        className === 'resume-profile-card' ? h('div', { className: 'resume-profile-save' },
          h('div', { className: 'resume-profile-actions' },
            h(Button, { type: 'submit' }, 'Save details'),
            h(Button, { type: 'button', variant: 'danger' }, 'Delete resume'))) : 'Content')),
      h('ul', { className: 'job-listing-list' }, h(ContentCard, { as: 'li', className: 'job-listing' }, 'Job card')),
      h('ul', { className: 'experience-project-list' }, h(ContentCard, { as: 'li', className: 'experience-project-row' }, 'Evidence card')),
    ))).join('');
    const previewColumn = h('div', { className: 'resume-preview-column' },
      h('div', { className: 'resume-studio-toolbar' }, 'Toolbar'),
      h('div', { className: 'custom-pdf-pages-list' }, h('div', { className: 'resume-paper' }, 'Preview')));
    const preview = h('div', { className: 'resume-preview-workspace' }, previewColumn);
    const studioMarkup = renderToStaticMarkup(h(WorkspaceContainer,
      { mode: 'studio', className: 'resume-workspace', id: 'studio' },
      h('section', { id: 'resume-edit' }, preview)));
    const { OpportunityCard } = require('../../src/components/jobs/opportunity-card.tsx');
    const { OpportunityTailoredResume } = require('../../src/components/jobs/opportunity-tailored-resume.tsx');
    const opportunity = { id: 'test-job', revisionId: 'test-revision', title: 'An exceptionally long software engineering opportunity title', company: 'Studio', capturedAt: '2026-10-04T00:00:00.000Z', postedAt: 'Unknown', location: 'Remote', workStyle: 'Remote', originalUrl: 'https://jobs.example.test/job' };
    const jobMarkup = renderToStaticMarkup(h(WorkspaceContainer, { className: 'opportunity-details-workspace' },
      h('ul', { className: 'job-listing-list' }, h(OpportunityCard, { opportunity, index: 0 })),
      h(OpportunityTailoredResume, { opportunityId: opportunity.id, state: { fingerprint: 'test', expectedGenerationId: 'generation-one', modelLabel: 'Test local model', resume: { generationId: 'generation-one', updatedAt: opportunity.capturedAt, stale: true, sections: [{ heading: 'Experience', text: 'Engineer | Studio | 2024–2026\n- Built TypeScript UI' }], unknowns: [] } } })));
    const { OpportunityCreateForm } = require('../../src/components/jobs/opportunity-create-form.tsx');
    const captureMarkup = renderToStaticMarkup(h(WorkspaceContainer, { id: 'opportunity-add-form' }, h(OpportunityCreateForm)));
    const markup = { page: page + jobMarkup + captureMarkup, studio: studioMarkup };
    const reports = [];
    for (const width of [1280, 900, 640, 320]) {
      win.setContentSize(width, 900);
      const html = `<html><head><style>${css}</style></head><body><div class="application-shell">${sidebar}<main id="main-content">${markup.page}</main></div></body></html>`;
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      const result = await win.webContents.executeJavaScript(`(() => {
        const pages = [...document.querySelectorAll('.workspace-container')].map(el => {
          const css = getComputedStyle(el), rect = el.getBoundingClientRect();
          return { left: rect.left, width: rect.width, paddingLeft: css.paddingLeft,
            paddingTop: css.paddingTop, overflow: css.overflow, height: css.height };
        });
        const cards = [...document.querySelectorAll('.content-card')].map(el => {
          const css = getComputedStyle(el);
          return { padding: css.padding, radius: css.borderRadius, border: css.borderWidth };
        });
        const actions = [...document.querySelectorAll('.resume-profile-actions')].map(el => {
          const buttons = [...el.querySelectorAll('button')].map(button => {
            const rect = button.getBoundingClientRect();
            return { top: rect.top, right: rect.right, left: rect.left };
          });
          return { buttons, right: el.getBoundingClientRect().right };
        });
        const panel = document.querySelector('.workspace-section-panel');
        const rail = document.querySelector('.workspace-icon-rail');
        const menu = document.querySelector('.compact-navigation');
        const main = document.querySelector('main');
        return { panelVisible: getComputedStyle(panel).display !== 'none',
          menuVisible: getComputedStyle(menu).display !== 'none', railWidth: rail.getBoundingClientRect().width,
          bodyOverflow: document.body.scrollWidth > window.innerWidth, pages, cards, actions, mainScroll: main.scrollHeight > main.clientHeight,
          horizontalOverflow: main.scrollWidth > main.clientWidth,
          mainWidth: main.clientWidth };
      })()`);
      assert.ok(result.pages.every(p => p.left === result.pages[0].left && p.width === result.pages[0].width), `aligned edges at ${width}`);
      assert.ok(result.pages.every(p => p.paddingLeft === result.pages[0].paddingLeft && p.paddingTop === result.pages[0].paddingTop), `shared gutters at ${width}`);
      assert.ok(result.cards.every(c => c.padding === result.cards[0].padding && c.radius === result.cards[0].radius && c.border === result.cards[0].border), `shared cards at ${width}`);
      if (width === 1280) assert.ok(result.actions.every(a => a.buttons[0].top === a.buttons[1].top), 'Save and Delete are adjacent on desktop');
      assert.ok(result.actions.every(a => a.buttons.every(b => b.right <= a.right + 1)), `action row fits at ${width}`);
      assert.ok(result.mainScroll, `page scrolling at ${width}`);
      assert.equal(result.horizontalOverflow, false, `horizontal overflow at ${width}`);
      assert.equal(result.panelVisible, width > 1024, `context panel at ${width}`);
      assert.equal(result.menuVisible, width <= 1024, `compact menu at ${width}`);
      assert.equal(result.bodyOverflow, false, `shell fits at ${width}`);
      if (width === 1280) {
        fs.writeFileSync('/private/tmp/sidebar-preview.png', (await win.webContents.capturePage()).toPNG());
        const collapsed = await win.webContents.executeJavaScript(`(() => {
          document.documentElement.classList.add('sidebar-collapsed');
          const panel = document.querySelector('.workspace-section-panel');
          return { hidden: getComputedStyle(panel).display === 'none',
            width: document.querySelector('.app-header').getBoundingClientRect().width,
            toggleVisible: getComputedStyle(document.querySelector('.sidebar-collapse-button')).display !== 'none' };
        })()`);
        assert.equal(collapsed.hidden, true);
        assert.equal(collapsed.toggleVisible, true);
        assert.ok(collapsed.width <= 74, 'collapsed sidebar is a rail');
      }
      reports.push({ width, ...result });
    }
    win.setContentSize(1280, 900);
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<html><head><style>${css}</style></head><body><div class="application-shell">${sidebar}<main id="main-content">${markup.studio}</main></div></body></html>`));
    const studio = await win.webContents.executeJavaScript(`(() => {
      const main = document.querySelector('main');
      const el = document.querySelector('#studio');
      return { mainHeight: main.clientHeight, studioHeight: el.clientHeight,
        mainOverflow: getComputedStyle(main).overflow, studioOverflow: getComputedStyle(el).overflow,
        minHeight: getComputedStyle(el).minHeight, canvasHeight: document.querySelector('#resume-edit').clientHeight };
    })()`);
    assert.ok(studio.studioHeight <= studio.mainHeight, 'studio fits available height');
    assert.equal(studio.studioOverflow, 'hidden');
    assert.equal(studio.mainOverflow, 'hidden');
    assert.equal(studio.minHeight, '0px');
    assert.ok(studio.canvasHeight > 0, 'canvas has available space');
    fs.writeFileSync('/private/tmp/epic16-browser-results.json', JSON.stringify({ reports, studio }, null, 2));
    console.log('PASS: Chromium checks for aligned gutters, consistent cards, page scrolling at 1280/900/640/320px, and constrained Resume studio.');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
