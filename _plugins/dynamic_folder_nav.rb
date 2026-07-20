# Builds a fully dynamic file tree from the repository contents.
#
# Each entry represents either a folder or a leaf file. Folders that contain
# a README link directly to that README's generated page; leaf files link to
# the raw file on GitHub. Folders without a README and without any visible
# descendants are skipped so the sidebar only lists meaningful branches.
module DynamicFolderNav
  class Generator < Jekyll::Generator
    EXCLUDED_DIRS = %w[.git .github .claude _site vendor .bundle _includes _layouts assets _plugins].freeze
    EXCLUDED_ROOT_FILES = %w[Gemfile Gemfile.lock _config.yml index.md README.md .gitignore .nav.yml].freeze
    MAX_DEPTH = 4
    RAW_URL = "https://raw.githubusercontent.com/sglbl/gnulinux-config/main".freeze

    def generate(site)
      root = File.expand_path(site.source)
      tree = build_dir(root, "").compact
      tree = tree.select { |node| meaningful?(node) }

      site.config["awesome_nav_tree"] = tree
      site.config["dynamic_folder_nav"] = tree

      site.pages.each do |page|
        page.data["dynamic_folder_nav"] = tree
      end
    end

    private

    def excluded_dir?(name)
      EXCLUDED_DIRS.include?(name) || name.start_with?(".")
    end

    def build_dir(absolute_dir, relative_dir)
      entries = []
      Dir.children(absolute_dir).sort.each do |name|
        child_absolute = File.join(absolute_dir, name)
        child_relative = relative_dir.empty? ? name : File.join(relative_dir, name)

        if File.directory?(child_absolute)
          next if excluded_dir?(name)
          next if child_relative.split("/").length > MAX_DEPTH

          node = build_folder(child_absolute, child_relative)
          entries << node if node
        elsif File.file?(child_absolute) && !name.start_with?(".")
          next if relative_dir.empty? && EXCLUDED_ROOT_FILES.include?(name)
          next if name.downcase.start_with?("readme.")

          entries << build_file(child_relative)
        end
      end
      entries
    end

    def build_folder(absolute_dir, relative_dir)
      children = build_dir(absolute_dir, relative_dir)
      has_readme = readme?(absolute_dir)

      if !has_readme && children.empty?
        return nil
      end

      node = {
        "title" => titleize(File.basename(relative_dir)),
        "children" => children
      }
      node["url"] = "/#{relative_dir}/" if has_readme
      node
    end

    def build_file(relative_path)
      base = File.basename(relative_path)
      ext = File.extname(base).downcase

      if ext == ".md" || ext == ".markdown" || ext == ".html"
        url = "/#{relative_path.sub(/\.(md|markdown|html)\z/i, "/")}"
        {
          "title" => titleize(File.basename(relative_path, ".*")),
          "url" => url
        }
      else
        {
          "title" => base,
          "url" => "#{RAW_URL}/#{relative_path}"
        }
      end
    end

    def readme?(absolute_dir)
      %w[README.md README.markdown readme.md].any? do |name|
        File.exist?(File.join(absolute_dir, name))
      end
    end

    def meaningful?(node)
      return false if node.nil?
      return true if node["url"]
      Array(node["children"]).any? { |child| meaningful?(child) }
    end

    def titleize(value)
      value.to_s
        .tr("_-", " ")
        .split
        .map { |part| part[0] ? "#{part[0].upcase}#{part[1..]}" : part }
        .join(" ")
    end
  end
end