export default function MCQAnswers({ options, myAnswer, answerResult, submitAnswer }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {options?.map((option) => {
        const isSelected = myAnswer === option.id
        const showResult = answerResult && isSelected

        return (
          <button
            key={option.id}
            onClick={() => !myAnswer && submitAnswer(option.id)}
            disabled={!!myAnswer}
            className={`p-4 rounded-xl text-left transition-all border ${
              showResult
                ? answerResult.isCorrect
                  ? 'bg-emerald-600/30 border-emerald-500'
                  : 'bg-rose-600/30 border-rose-500'
                : isSelected
                ? 'bg-teal-600/30 border-teal-500'
                : 'bg-slate-800/60 hover:bg-slate-700/60 border-slate-700'
            } ${myAnswer && !isSelected ? 'opacity-50' : ''}`}
          >
            <p className="font-semibold">{option.name}</p>
            {option.artist && <p className="text-sm text-slate-300">{option.artist}</p>}
          </button>
        )
      })}
    </div>
  )
}
