/* Persistencia con localStorage — estructurada */
const DB = {
  KEY: 'fightlist-pro-v1',

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) return JSON.parse(raw);
    } catch(e) { console.warn('DB load error', e); }
    return this.defaults();
  },

  save(state) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(state));
    } catch(e) { console.error('DB save error', e); }
  },

  defaults() {
    const now = new Date().toISOString().slice(0,10);
    return {
      activeCompId: 'comp-1',
      comps: [
        {
          id: 'comp-1',
          name: 'Mi Competición',
          date: now,
          place: '',
          organizer: '',
          mats: 2,
          matNames: ['Tapiz 1', 'Tapiz 2'],
          extra: '',
          archived: false,
          schedule: { start:'09:00', duration: 15, breakMin: 5 },
          fights: [],
          customFields: []
        }
      ],
      settings: {
        theme: 'dark',
        primary: '#3b7bff',
        accent: '#ff3d5a',
        fontSize: 15,
        animationSpeed: 1,
        competitionMode: false,
        bgImage: null
      }
    };
  }
};
