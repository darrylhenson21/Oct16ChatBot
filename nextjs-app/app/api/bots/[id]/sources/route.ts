import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabaseAdmin } from '@/lib/supabaseServer'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: sources, error } = await supabaseAdmin()
      .from('sources')
      .select('id, name, type, status, created_at')
      .eq('bot_id', params.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Get chunk counts for each source
    const sourcesWithCounts = await Promise.all(
      sources.map(async (source) => {
        const { count } = await supabaseAdmin()
          .from('chunks')
          .select('*', { count: 'exact', head: true })
          .eq('source_id', source.id)

        return {
          ...source,
          chunk_count: count || 0,
        }
      })
    )

    return NextResponse.json(sourcesWithCounts)
  } catch (error: any) {
    console.error('Get sources error:', error)
    return NextResponse.json({ error: 'Failed to load sources' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log(`📤 Processing file: ${file.name}`)

    const buffer = Buffer.from(await file.arrayBuffer())
    let text = ''
    let fileType = ''

    // Extract text based on file type
    if (file.name.endsWith('.pdf')) {
      try {
        const pdfParse = (await import('pdf-parse')).default
        const pdfData = await pdfParse(buffer)
        text = pdfData.text
        fileType = 'pdf'
      } catch (error) {
        console.error('PDF parsing error:', error)
        return NextResponse.json({ 
          error: 'PDF parsing failed. Try converting to TXT or DOCX.' 
        }, { status: 400 })
      }
    } else if (file.name.endsWith('.txt')) {
      text = buffer.toString('utf-8')
      fileType = 'txt'
    } else if (file.name.endsWith('.docx')) {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
      fileType = 'docx'
    } else {
      return NextResponse.json({ 
        error: 'Unsupported file type. Use PDF, TXT, or DOCX.' 
      }, { status: 400 })
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ 
        error: 'No text content found in file' 
      }, { status: 400 })
    }

    console.log(`📝 Extracted ${text.length} characters`)

    // Create source record
    const { data: source, error: sourceError } = await supabaseAdmin()
      .from('sources')
      .insert({
        bot_id: params.id,
        name: file.name,
        type: fileType,
        status: 'processing',
      })
      .select()
      .single()

    if (sourceError) {
      console.error('Source creation error:', sourceError)
      throw sourceError
    }

    console.log(`✅ Source created: ${source.id}`)

    // Split text into chunks
    const chunks = splitIntoChunks(text, 500)
    console.log(`📦 Split into ${chunks.length} chunks`)

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]

      try {
        // Generate embedding using the CORRECT model
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small', // FIXED: Using correct model
          input: chunk,
        })

        const embedding = embeddingResponse.data[0].embedding

        // Insert chunk with embedding (removed chunk_index)
        const { error: chunkError } = await supabaseAdmin()
          .from('chunks')
          .insert({
            source_id: source.id,
            bot_id: params.id,
            content: chunk,
            embedding: embedding,
          })

        if (chunkError) {
          console.error(`Chunk ${i} insert error:`, chunkError)
          throw chunkError
        }

        console.log(`✅ Chunk ${i + 1}/${chunks.length} processed`)
      } catch (chunkError) {
        console.error(`Error processing chunk ${i}:`, chunkError)
        // Continue processing other chunks even if one fails
      }
    }

    // Update source status to completed
    await supabaseAdmin()
      .from('sources')
      .update({ status: 'completed' })
      .eq('id', source.id)

    console.log(`🎉 Processing complete: ${chunks.length} chunks created`)

    return NextResponse.json({ 
      success: true,
      source_id: source.id,
      chunks_created: chunks.length 
    })

  } catch (error: any) {
    console.error('❌ Upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const sourceId = searchParams.get('sourceId')

    if (!sourceId) {
      return NextResponse.json({ error: 'Source ID required' }, { status: 400 })
    }

    // Delete all chunks associated with this source
    await supabaseAdmin()
      .from('chunks')
      .delete()
      .eq('source_id', sourceId)

    // Delete the source
    const { error } = await supabaseAdmin()
      .from('sources')
      .delete()
      .eq('id', sourceId)
      .eq('bot_id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete source error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete source' },
      { status: 500 }
    )
  }
}

function splitIntoChunks(text: string, maxTokens: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  const chunks: string[] = []
  let currentChunk = ''

  for (const sentence of sentences) {
    const estimatedTokens = (currentChunk + sentence).length / 4

    if (estimatedTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk += ' ' + sentence
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim())
  }

  return chunks.filter(chunk => chunk.length > 0)
}
