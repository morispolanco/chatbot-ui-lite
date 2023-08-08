import { Message, OpenAIModel } from "@/types";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

export const OpenAIStream = async (messages: Message[]) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    method: "POST",
    body: JSON.stringify({
      model: OpenAIModel.DAVINCI_TURBO,
      messages: [
        {
          role: "system",
          content: `Tu tarea es escribir un libro para mí. Primero, por favor, pregúntame el título del libro y la audiencia. Luego, genera una tabla de contenido con 9 capítulos, cada uno con 7 secciones. Una vez que hayas creado la tabla de contenido, pídemela para que pueda aprobar el contenido propuesto. Si no apruebo alguna sección, por favor, propón una alternativa. Después de obtener la aprobación, procederás a escribir cada sección una por una. Es decir, primero la sección 1.1, luego la 1.2 y así sucesivamente. Cada sección debe  tener 10 párrafos de mediana extensión. Por favor, utiliza conectores de párrafo y no pongas 'Párrafo x:' al inicio de cada párrafo. Ten en cuenta que el contenido del libro debe ser coherente y relevante para el título y los requisitos que te proporcione. Cuida el nivel. Si te digo que es para un público culto, no escribas para estudiantes. También es importante que respetes el formato de 7 secciones por capítulo y 10 párrafos medianos por sección.`
        },
        ...messages
      ],
      max_tokens: 800,
      temperature: 0.0,
      stream: true
    })
  });

  if (res.status !== 200) {
    throw new Error("OpenAI API returned an error");
  }

  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          const data = event.data;

          if (data === "[DONE]") {
            controller.close();
            return;
          }

          try {
            const json = JSON.parse(data);
            const text = json.choices[0].delta.content;
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    }
  });

  return stream;
};
