'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function createProject(name: string) {
  if (!name) {
    throw new Error('Project name is required')
  }

  try {
    // Create project first
    const project = await prisma.project.create({
      data: {
        name,
      },
    })

    if (!project) {
      throw new Error('Failed to create project')
    }

    // Create initial chat
    const chat = await prisma.chat.create({
      data: {
        title: 'General',
        projectId: project.id,
      },
    })

    if (!chat) {
      // If chat creation fails, delete the project to maintain consistency
      await prisma.project.delete({
        where: { id: project.id }
      })
      throw new Error('Failed to create initial chat')
    }

    // Revalidate the projects list
    revalidatePath('/')
    revalidatePath('/create-project')

    return { success: true, projectId: project.id, chatId: chat.id }
  } catch (error) {
    console.error('Error in createProject:', error)
    throw error instanceof Error ? error : new Error('Failed to create project')
  }
}

export async function uploadProjectFiles(projectId: string, files: any[]) {
  if (!projectId) {
    throw new Error('Project ID is required')
  }

  try {
    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      throw new Error('Project not found')
    }

    // Create files
    const createdFiles = await prisma.file.createMany({
      data: files.map(file => ({
        name: typeof file === 'string' ? file : file.name,
        path: `/uploads/${typeof file === 'string' ? file : file.name}`,
        type: typeof file === 'string' ? 'unknown' : file.type,
        size: typeof file === 'string' ? 0 : file.size,
        projectId
      }))
    })

    // Revalidate project page
    revalidatePath(`/project/${projectId}`)

    return { success: true, count: createdFiles.count }
  } catch (error) {
    console.error('Error in uploadProjectFiles:', error)
    throw error instanceof Error ? error : new Error('Failed to upload files')
  }
}
