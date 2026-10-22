  (() => {
    const wrap         = document.querySelector('.select-wrap');
    const trigger      = wrap.querySelector('.select');
    const triggerValue = trigger.querySelector('.value .label');
    const listbox      = wrap.querySelector('.listbox');
    const scroller     = wrap.querySelector('.listbox-scroller');
    const searchInput  = wrap.querySelector('.search');
    const emptyState   = wrap.querySelector('.empty');
    const groups       = [...wrap.querySelectorAll('.group')];
    const allOptions   = [...wrap.querySelectorAll('.option')];

    let visibleOptions = [...allOptions];
    let activeIndex = -1;
    let busy = false;

    const normalize = (s) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    function decideDirection() {
      const triggerRect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;
      const needed = Math.min(window.innerHeight * 0.65, 420);

      const up = spaceBelow < needed && spaceAbove > spaceBelow;
      listbox.dataset.drop = up ? 'up' : 'down';
    }

    function open() {
      if (wrap.classList.contains('open') || busy) return;
      wrap.classList.add('open');
      trigger.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      searchInput.value = '';
      filter('');
      decideDirection();
      const i = visibleOptions.findIndex(o => o.getAttribute('aria-selected') === 'true');
      highlight(i >= 0 ? i : 0);
      requestAnimationFrame(() => searchInput.focus());
      updateScrollHints();
    }

    function close() {
      if (!wrap.classList.contains('open')) return;
      wrap.classList.remove('open');
      trigger.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
      allOptions.forEach(o => o.classList.remove('active'));
      activeIndex = -1;
    }

    function filter(term) {
      const q = normalize(term.trim());

      allOptions.forEach(opt => {
        if (opt.dataset.value === '' && q === '') {
          opt.classList.remove('hidden');
          return;
        }
        const match = q === '' || normalize(opt.dataset.label || '').includes(q);
        opt.classList.toggle('hidden', !match);
      });

      groups.forEach(g => {
        const anyVisible = [...g.querySelectorAll('.option')].some(o => !o.classList.contains('hidden'));
        g.classList.toggle('hidden', !anyVisible);
      });

      visibleOptions = allOptions.filter(o => !o.classList.contains('hidden'));

      const anyMatch = visibleOptions.some(o => o.dataset.value !== '');
      emptyState.classList.toggle('show', q !== '' && !anyMatch);

      activeIndex = -1;
      if (visibleOptions.length) highlight(0);
      updateScrollHints();
    }

    function highlight(i) {
      visibleOptions.forEach(o => o.classList.remove('active'));
      if (i < 0 || i >= visibleOptions.length) return;
      activeIndex = i;
      visibleOptions[i].classList.add('active');
      visibleOptions[i].scrollIntoView({ block: 'nearest' });
      updateScrollHints();
    }

    function updateScrollHints() {
      if (!wrap.classList.contains('open')) return;
      const { scrollTop, scrollHeight, clientHeight } = scroller;
      listbox.classList.toggle('at-bottom', scrollTop + clientHeight >= scrollHeight - 2);
    }

    scroller.addEventListener('scroll', updateScrollHints, { passive: true });
    window.addEventListener('resize', () => {
      updateScrollHints();
      if (wrap.classList.contains('open')) decideDirection();
    });

    function flyOptionToTrigger(optionEl, done) {
      const src = optionEl.getBoundingClientRect();
      const dst = trigger.getBoundingClientRect();

      const clone = optionEl.cloneNode(true);
      clone.classList.add('fly-option');
      clone.classList.remove('hidden', 'active');
      clone.removeAttribute('id');
      clone.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));

      clone.style.width  = src.width  + 'px';
      clone.style.height = src.height + 'px';
      clone.style.left   = src.left   + 'px';
      clone.style.top    = src.top    + 'px';

      clone.style.setProperty('--tx', '0px');
      clone.style.setProperty('--ty', '0px');
      clone.style.setProperty('--sx', '1');
      clone.style.setProperty('--sy', '1');

      clone.style.background = 'linear-gradient(100deg, #6d4dff 0%, #a855f7 60%, #c084fc 100%)';
      clone.style.color = '#fff';

      document.body.appendChild(clone);
      void clone.offsetWidth;

      const tx = dst.left - src.left;
      const ty = dst.top  - src.top;
      const sx = dst.width  / src.width;
      const sy = dst.height / src.height;

      clone.style.setProperty('--tx', tx + 'px');
      clone.style.setProperty('--ty', ty + 'px');
      clone.style.setProperty('--sx', sx);
      clone.style.setProperty('--sy', sy);
      clone.classList.add('landing');

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;

        triggerValue.textContent = optionEl.dataset.label;
        trigger.classList.toggle('placeholder', optionEl.dataset.value === '');

        trigger.classList.remove('flash-trigger');
        void trigger.offsetWidth;
        trigger.classList.add('flash-trigger');

        setTimeout(() => clone.remove(), 60);
        done();
      };

      clone.addEventListener('transitionend', (e) => {
        if (e.propertyName === 'transform') finish();
      });
      setTimeout(finish, 500);
    }

    function choose(i) {
      const opt = visibleOptions[i];
      if (!opt || busy) return;
      busy = true;

      allOptions.forEach(o => o.setAttribute('aria-selected', 'false'));
      opt.setAttribute('aria-selected', 'true');

      close();
      flyOptionToTrigger(opt, () => {
        busy = false;
        trigger.focus();
      });
    }

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (busy) return;
      wrap.classList.contains('open') ? close() : open();
    });

    trigger.addEventListener('keydown', (e) => {
      if (busy) return;
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (!wrap.classList.contains('open')) open();
          else choose(activeIndex);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!wrap.classList.contains('open')) open();
          else highlight(Math.min(activeIndex + 1, visibleOptions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (!wrap.classList.contains('open')) open();
          else highlight(Math.max(activeIndex - 1, 0));
          break;
        case 'Home':
          if (wrap.classList.contains('open')) { e.preventDefault(); highlight(0); }
          break;
        case 'End':
          if (wrap.classList.contains('open')) {
            e.preventDefault();
            highlight(visibleOptions.length - 1);
          }
          break;
        case 'Escape':
          if (wrap.classList.contains('open')) { e.preventDefault(); close(); }
          break;
        case 'Tab':
          close();
          break;
      }
    });

    searchInput.addEventListener('input', (e) => filter(e.target.value));

    searchInput.addEventListener('keydown', (e) => {
      if (busy) return;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          highlight(Math.min(activeIndex + 1, visibleOptions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          highlight(Math.max(activeIndex - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          choose(activeIndex);
          break;
        case 'Escape':
          if (searchInput.value) {
            e.stopPropagation();
            searchInput.value = '';
            filter('');
          } else {
            e.preventDefault();
            close();
            trigger.focus();
          }
          break;
        case 'Tab':
          close();
          break;
      }
    });

    allOptions.forEach((opt) => {
      opt.addEventListener('mouseenter', () => {
        if (busy) return;
        const idx = visibleOptions.indexOf(opt);
        if (idx >= 0) highlight(idx);
      });
      opt.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = visibleOptions.indexOf(opt);
        if (idx >= 0) choose(idx);
      });
    });

    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target) && !busy) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !busy) close();
    });
  })();
