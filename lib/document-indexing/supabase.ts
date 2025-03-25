import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Ensure the vector extension is enabled and documents table exists
export async function setupVectorStore() {
  try {
    // Enable vector extension if not already enabled
    const { error: extensionError } = await supabase.rpc('enable_vectors');
    
    if (extensionError && !extensionError.message.includes('already exists')) {
      console.error('Error enabling vector extension:', extensionError);
    }

    // Create documents table with vector support
    // Note: This would typically be done via migrations in a production app
    const { error: tableError } = await supabase.rpc('create_documents_table');
    
    if (tableError && !tableError.message.includes('already exists')) {
      console.error('Error creating documents table:', tableError);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error setting up vector store:', error);
    return { success: false, error };
  }
}

// Function to create the stored procedures if they don't exist
export async function createStoredProcedures() {
  try {
    // Create the match_documents function
    const { error: matchError } = await supabase.rpc('create_match_documents_function');
    
    if (matchError && !matchError.message.includes('already exists')) {
      console.error('Error creating match_documents function:', matchError);
    }

    // Create the enable_vectors function
    const { error: enableError } = await supabase.rpc('create_enable_vectors_function');
    
    if (enableError && !enableError.message.includes('already exists')) {
      console.error('Error creating enable_vectors function:', enableError);
    }

    // Create the create_documents_table function
    const { error: createTableError } = await supabase.rpc('create_create_documents_table_function');
    
    if (createTableError && !createTableError.message.includes('already exists')) {
      console.error('Error creating create_documents_table function:', createTableError);
    }

    return { success: true };
  } catch (error) {
    console.error('Error creating stored procedures:', error);
    return { success: false, error };
  }
} 