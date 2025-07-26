import React, { useState } from 'react'
import { X, AlertTriangle, CheckCircle, Edit, Plus } from 'lucide-react'

interface PotentialDuplicate {
  candidateFAQ: {
    question: string
    answer: string
    category: string
    confidence: number
  }
  duplicateMatches: Array<{
    id: string
    score: number
    metadata: {
      category: string
      status: string
      question: string
    }
    existingAnswer?: string
  }>
}

interface DuplicateReviewModalProps {
  isOpen: boolean
  onClose: () => void
  duplicates: PotentialDuplicate[]
  onResolve: (decisions: Array<{
    candidateIndex: number
    action: 'skip' | 'create' | 'enhance'
    targetFAQId?: string
  }>) => void
}

export default function DuplicateReviewModal({
  isOpen,
  onClose,
  duplicates,
  onResolve
}: DuplicateReviewModalProps) {
  const [decisions, setDecisions] = useState<Record<number, {
    action: 'skip' | 'create' | 'enhance'
    targetFAQId?: string
  }>>({})

  if (!isOpen) return null

  const handleDecision = (candidateIndex: number, action: 'skip' | 'create' | 'enhance', targetFAQId?: string) => {
    setDecisions(prev => ({
      ...prev,
      [candidateIndex]: { action, targetFAQId }
    }))
  }

  const handleResolveAll = () => {
    const resolvedDecisions = duplicates.map((_, index) => ({
      candidateIndex: index,
      action: decisions[index]?.action || 'skip',
      targetFAQId: decisions[index]?.targetFAQId
    }))
    
    onResolve(resolvedDecisions)
    setDecisions({})
  }

  const getSimilarityColor = (score: number) => {
    if (score >= 0.95) return 'text-red-600 bg-red-50'
    if (score >= 0.90) return 'text-orange-600 bg-orange-50'
    if (score >= 0.85) return 'text-yellow-600 bg-yellow-50'
    return 'text-gray-600 bg-gray-50'
  }

  const getSimilarityLabel = (score: number) => {
    if (score >= 0.95) return 'Nearly Identical'
    if (score >= 0.90) return 'Very Similar'
    if (score >= 0.85) return 'Similar'
    return 'Somewhat Similar'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Potential Duplicates Found
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Review {duplicates.length} potential duplicate FAQ{duplicates.length !== 1 ? 's' : ''} before creating
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          {duplicates.map((duplicate, candidateIndex) => (
            <div key={candidateIndex} className="p-6 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
              {/* New FAQ Candidate */}
              <div className="mb-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Plus className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">New FAQ Candidate</span>
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded">
                    {Math.round(duplicate.candidateFAQ.confidence * 100)}% confidence
                  </span>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    {duplicate.candidateFAQ.question}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                    {duplicate.candidateFAQ.answer}
                  </p>
                </div>
              </div>

              {/* Similar Existing FAQs */}
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Similar Existing FAQs ({duplicate.duplicateMatches.length})
                </h5>
                <div className="space-y-3">
                  {duplicate.duplicateMatches.slice(0, 2).map((match, matchIndex) => (
                    <div key={matchIndex} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h6 className="font-medium text-gray-900 dark:text-white text-sm">
                          {match.metadata.question}
                        </h6>
                        <span className={`px-2 py-1 text-xs rounded-full ${getSimilarityColor(match.score)}`}>
                          {Math.round(match.score * 100)}% {getSimilarityLabel(match.score)}
                        </span>
                      </div>
                      {match.existingAnswer && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                          {match.existingAnswer}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Decision Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleDecision(candidateIndex, 'skip')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    decisions[candidateIndex]?.action === 'skip'
                      ? 'bg-red-100 text-red-700 border-2 border-red-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600'
                  }`}
                >
                  <X className="h-4 w-4 inline mr-1" />
                  Skip (It&apos;s a duplicate)
                </button>
                
                <button
                  onClick={() => handleDecision(candidateIndex, 'create')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    decisions[candidateIndex]?.action === 'create'
                      ? 'bg-green-100 text-green-700 border-2 border-green-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-green-50 hover:text-green-600'
                  }`}
                >
                  <Plus className="h-4 w-4 inline mr-1" />
                  Create Anyway (It&apos;s different)
                </button>
                
                {duplicate.duplicateMatches.length > 0 && (
                  <button
                    onClick={() => handleDecision(candidateIndex, 'enhance', duplicate.duplicateMatches[0].id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      decisions[candidateIndex]?.action === 'enhance'
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                    }`}
                  >
                    <Edit className="h-4 w-4 inline mr-1" />
                    Enhance Best Match
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {Object.keys(decisions).length} of {duplicates.length} decisions made
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleResolveAll}
              disabled={Object.keys(decisions).length < duplicates.length}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle className="h-4 w-4 inline mr-1" />
              Apply Decisions
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 