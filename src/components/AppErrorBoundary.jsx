import { Component } from 'react'

/** Last line of defense: never show a blank screen — offer a reload. */
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('App crashed:', error)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas p-6 text-center">
        <div>
          <p className="text-lg font-semibold text-ink">Something went wrong</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-ink-2">
            The app hit an unexpected error — usually a new version was just deployed.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black"
          >
            Reload app
          </button>
        </div>
      </div>
    )
  }
}
