from dealforge.plugins.base import VectorStore, AnswerGenerator

class RagEngine:
    def __init__(self, vectorstore: VectorStore, generator: AnswerGenerator, top_k: int = 4):
        self.vectorstore = vectorstore
        self.generator = generator
        self.top_k = top_k

    async def generate_answer(self, question: str) -> str:
        try:
            # MVP: just use question text as vector equivalent for dummy vectorstore
            context_chunks = await self.vectorstore.query(question, self.top_k)
            answer = await self.generator.generate(question, context_chunks)
            return answer
        except Exception as e:
            print(f"[RagEngine] Error generating answer: {e}")
            return "Sorry, I couldn't generate an answer at this time."

# Dummy AnswerGenerator for MVP flow without real LLM call
class DummyAnswerGenerator(AnswerGenerator):
    async def generate(self, question: str, context: list) -> str:
        return f"Here is what I found about '{question}' based on the collateral."
