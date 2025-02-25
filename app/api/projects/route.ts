import { NextResponse } from 'next/server';
import { createProject, uploadProjectFiles } from '@/app/actions';

export async function POST(req: Request) {
  try {
    let name: string;
    let files: any[] = [];

    const contentType = req.headers.get('content-type');
    if (contentType?.includes('multipart/form-data')) {
      const formData = await req.formData();
      name = formData.get('name') as string;
      files = Array.from(formData.getAll('files'));
    } else {
      const json = await req.json();
      name = json.name;
      files = json.files || [];
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    console.log('Creating project with name:', name);
    console.log('Files:', files);

    // Create project and initial chat
    const result = await createProject(name);

    // Upload files if any
    if (files.length > 0) {
      await uploadProjectFiles(result.projectId, files);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating project:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create project: ' + errorMessage },
      { status: 500 }
    );
  }
}
