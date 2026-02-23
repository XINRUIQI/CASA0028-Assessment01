import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  handleRetry = () => this.setState({ hasError: false, error: null })

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-slate-900 text-slate-400 gap-3 p-6">
          <p className="text-sm font-semibold text-red-400">Something went wrong</p>
          <p className="text-xs text-slate-500 text-center max-w-xs">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="mt-1 px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
