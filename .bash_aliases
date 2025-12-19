# Environment
alias ac-base='source ~/.local/share/uv/environments/base/bin/activate'
alias ac="source .venv/bin/activate"
alias de="deactivate"

# Nvidia
alias smi="watch nvidia-smi"

# File Explorer & Terminal
alias exp="nautilus . &"
alias explore="nautilus . &"
alias explore2="thunar . &"
alias ter="gnome-terminal"
alias rmcache="find . -type d -name '__pycache__' -exec rm -rf {} +"
alias grephist='hist | grep'
alias printpath="echo $PATH | tr : '\n'"
alias şs='ls -CF'
alias lss='du -xh --max-depth '
alias ts='tree --du -h -L '
alias hist='history | awk '\''{$1=""; print substr($0,2)}'\'''
histn() { history | tail -n "${1:-10}" | awk '{$1=""; print substr($0,2)}'; }

# Process related
alias destroy="sudo pkill -9"

# Custom
alias ghd="git-heatgrid -c -g 4 -l -w 3"
alias hg="gnome-terminal --window --maximize -- bash -ic 'ghd; exec bash'"

# Onion Architecture
alias cdm="cd src/presentation/ui/mobile"
alias cdw="cd src/presentation/ui/web"

# Npm

# Load npm completion

# Note that you have to do this for one time:
#####
# Install npm completion script:
# npm completion >> ~/.npm-completion.sh
# Source it in your .bashrc:
# source ~/.npm-completion.sh
#####

if [ -f ~/.npm-completion.sh ]; then
    source ~/.npm-completion.sh
fi

# Alias
alias nr='npm run'

# Hook alias into npm's completion for script names
_npm_run_completion() {
    # Replace 'nr' with 'npm run' in the current line
    local cur
    cur="${COMP_WORDS[COMP_CWORD]}"
    COMP_WORDS=(npm run "${COMP_WORDS[@]:1}")
    COMP_CWORD=$((COMP_CWORD + 1))
    _npm_completion
}

complete -o default -F _npm_run_completion nr
