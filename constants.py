# System prompt for the agent
system_prompt = """
You are a helpful AI ASSISTANT inside a complex Agentic graph that can setup any github online repository on user's PC.
If an Output schema is defined by the user then do not output any single character other than that schema
"""

# Define the prompt for extracting file paths
format_dir = """
Output the directory content in following format:
{
    readme : path of readme if exist else empty strings like "" (eg: ./folder1/folder2/README.md)
    requirements : path of requirements if exist else empty strings like "" (eg: ./folder1/folder2/requirements.txt)
}

Remeber we are already in the repo folder so double check the path you generate. It should be accurate!!
OUTPUT SHOULD BE THE ABOVE JSON FORMAT ANY NOTHING ELSE NOT EVEN A SINGLE CHARACTER EXTRA, NO EXPLANATION , NOTHING ELSE JUST THE JSON FORMAT.
"""

# Prompt for extracting setup instructions from README
readme_prompt = """
Find the setup instructions in the readme file and output only the setup instructions part in a well formatted manner if setup instructions are present otherwise no if not present. 
Output should be setup instructions or no, and nothing else.
Remember to output the setup instructions only and not the entire readme file.
"""

# Prompt for planning the setup
plan_prompt = """
## Task

Analyze the given GitHub repository and create a Pinokio script to install and run the application.

## Instructions

1.  **Focus on Pinokio:** Create a Pinokio script that uses the `shell.run` method to install dependencies and run the application.
2.  **Dependency Installation:** Identify the correct way to install dependencies (e.g., using `pip install -r requirements.txt`, `playwright install --with-deps`, `npm install`).
3.  **Application Launch:** Identify the correct command(s) to launch the application (e.g., `python app.py`, `npm run start`).
4.  **Description:** Provide a short description of the application for `pinokio.js`.
5.  **Requirements:** Provide the content for `requirements.txt` if it exists. If not, generate a default `requirements.txt` based on the programming language (e.g., for Python: flask, numpy, requests).
6.  **Multiple Commands:** If the application requires multiple commands to run, provide them as a list of commands.
7.  **Terminal Monitoring:** If the application prints a specific message when it's ready, provide a regular expression to monitor the terminal output.

## Output Format

Provide the install command, start command(s), description, requirements, and terminal monitoring regex in the following JSON format:

{
    "install_script": "Single line install command (e.g., pip install -r requirements.txt)",
    "start_script": "Single line or multi line start command(s) (e.g., python app.py or [python app.py, npm run start])",
    "description": "Single line description for pinokio.js (e.g., A simple Python application)",
    "requirements": "Single line requirements.txt content (e.g., requests\\nnumpy)",
    "terminal_regex": "Regular expression to monitor the terminal output (e.g., /http:\\\\/\\\\/\\\\S+/)"
}

**DO NOT OUTPUT ANY SINGLE CHARACTER OUTSIDE OF THIS JSON STRUCTURE.**
"""

# Output schema for error fixing
output_schema = """
## Output Format

Provide the install command, start command(s), description, requirements, and terminal monitoring regex in the following JSON format:

{
    "install_script": "Single line install command (e.g., pip install -r requirements.txt)",
    "start_script": "Single line or multi line start command(s) (e.g., python app.py or [python app.py, npm run start])",
    "description": "Single line description for pinokio.js (e.g., A simple Python application)",
    "requirements": "Single line requirements.txt content (e.g., requests\\nnumpy). If requirements.txt is not found, provide default dependencies based on the programming language.",
    "terminal_regex": "Regular expression to monitor the terminal output (e.g., /http:\\\\/\\\\/\\\\S+/)"
}

**DO NOT OUTPUT ANY SINGLE CHARACTER OUTSIDE OF THIS JSON STRUCTURE.**
"""

pinokio_commands = {
    "shell.run": {
        "description": "Runs a shell command.",
        "syntax": """
        {
          "method": "shell.run",
          "params": {
            "message": <message>,
            "path": <path>,
            "env": <env>,
            "venv": <venv_path>,
            "conda": <conda_config>,
            "on": <shell_event_handler>,
            "sudo": <sudo>,
            "cache": <cache>
          }
        }
        """,
        "params": {
            "message": "The command to run. Can be a string or an array of strings.",
            "path": "(Optional) The path from which to start the shell session.",
            "env": "(Optional) Environment variables to set.",
            "venv": "(Optional) Path to a virtual environment to activate.",
            "conda": "(Optional) Configuration for a conda environment.",
            "on": "(Optional) Event handler for the shell output.",
            "sudo": "(Optional) Run in admin mode.",
            "cache": "(Optional) Cache path."
        }
    },
    "fs.download": {
        "description": "Downloads a file from a URL.",
        "syntax": """
        {
          "method": "fs.download",
          "params": {
            "uri": <uri>,
            <type>: <path>
          }
        }
        """,
        "params": {
            "uri": "The URL of the file to download.",
            "type": "Can be 'path' or 'dir'.",
            "path": "The destination path for the downloaded file.",
            "dir": "The destination directory for the downloaded file."
        }
    },
    "fs.write": {
        "description": "Writes data to a file.",
        "syntax": """
        {
          "method": "fs.write",
          "params": {
            "path": <path>,
            <type>: <data>
          }
        }
        """,
        "params": {
            "path": "The path to the file to write to.",
            "type": "Can be 'json', 'json2', 'text', or 'buffer'.",
            "data": "The data to write to the file."
        }
    },
    "script.start": {
        "description": "Starts another Pinokio script.",
        "syntax": """
        {
          "method": "script.start",
          "params": {
            "uri": <uri>,
            "hash": <commit>,
            "branch": <branch>,
            "pull": <should_pull>,
            "params": <params>
          }
        }
        """,
        "params": {
            "uri": "The path to the script to start.",
            "hash": "(Optional) The git commit hash to switch to.",
            "branch": "(Optional) The git branch to switch to.",
            "pull": "(Optional) If true, always run git pull before running code.",
            "params": "The parameters to pass to the script."
        }
    },
    "script.stop": {
        "description": "Stops a running Pinokio script.",
        "syntax": """
        {
          "method": "script.stop",
          "params": {
            "uri": <uri>
          }
        }
        """,
        "params": {
            "uri": "The path to the script to stop."
        }
    },
    "local.set": {
        "description": "Sets a local variable.",
        "syntax": """
        {
          "method": "local.set",
          "params": {
            <key>: <val>,
            ...
          }
        }
        """,
        "params": {
            "<key>": "The name of the local variable to set.",
            "<val>": "The value to set for the local variable."
        }
    },
    "log": {
        "description": "Logs a message to the console.",
        "syntax": """
        {
          "method": "log",
          "params": {
            <type>: <data>
          }
        }
        """,
        "params": {
            "type": "The type of data to log. Can be 'raw', 'text', 'json', or 'json2'.",
            "data": "The data to log."
        }
    },
    "requirements.txt": {
        "description": "Specifies the Python dependencies for the application.",
        "syntax": "A text file with one package name per line.",
        "example": """
        requests
        numpy
        pandas
        """,
        "output_format": "Single line requirements.txt content (e.g., requests\\nnumpy), use \\n for new line"
    }
}