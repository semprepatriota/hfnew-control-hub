module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "alliance-bg": "#070708",
        "alliance-dark": "#0f0f14",
        "neon-green": "#00FF41",
        "neon-gold": "#FFD700",
        "neon-blue": "#0066FF",
        "neon-red": "#FF0000",
      },
      boxShadow: {
        "neon-green": "0 0 20px rgba(0, 255, 65, 0.3)",
        "neon-gold": "0 0 20px rgba(255, 215, 0, 0.3)",
        "neon-blue": "0 0 20px rgba(0, 102, 255, 0.3)",
        "neon-red": "0 0 20px rgba(255, 0, 0, 0.3)",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto"],
      },
    },
  },
  plugins: [],
};
