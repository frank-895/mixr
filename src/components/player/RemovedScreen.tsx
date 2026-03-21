export function RemovedScreen() {
  return (
    <main className="screen center">
      <div
        className="brutal-card"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          textAlign: 'center',
          background: 'var(--white)',
        }}
      >
        <img src="/MIXR_logo.jpg" alt="MIXR" className="brand-logo" />

        <div
          style={{
            border: '4px solid var(--black)',
            padding: 16,
            background: 'var(--black)',
            color: 'var(--primary)',
            boxShadow: '4px 4px 0 var(--pink)',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(1.5rem, 6.5vw, 2.4rem)',
              lineHeight: 0.92,
              whiteSpace: 'nowrap',
            }}
          >
            REMOVED
          </h1>
        </div>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 700,
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          You have been removed from this game.
        </p>
      </div>
    </main>
  )
}
