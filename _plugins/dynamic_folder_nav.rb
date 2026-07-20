require "find"

# Builds a fully dynamic file tree from the repository contents.
#
# Each entry represents either a folder or a leaf file. Folders that contain
# a README link directly to that README's generated page; leaf files link to
# the raw file on GitHub. Folders without a README and without any visible
# descendants are skipped so the sidebar only lists meaningful branches.
module DynamicFolderNav
  class Generator < Jekyll::Generator
    EXCLUDED_PREFIXES = %w[.git .github .claude _site vendor .bundle _includes _layouts assets].freeze
    MAX_DEPTH = 4
    REPO_URL = "https://github.com/sglbl/gnulinux-config".freeze
    RAW_URL = "https://raw.githubusercontent.com/sglbl/gnulinux-config/main".freeze
    INCLUDED_EXTS = %w[.md .markdown .html .sh .desktop .json .toml .yaml .yml .ini .conf .css .js .png .svg .gif .jpg .jpeg].freeze

    def generate(site)
      root = File.expand_path(site.source)
      tree = build_children(root, "").select { |node| meaningful?(node) }

      site.config["awesome_nav_tree"] = tree
      site.config["dynamic_folder_nav"] = tree

      site.pages.each do |page|
        page.data["dynamic_folder_nav"] = tree
      end
    end

    private

    def excluded?(dir_name)
      EXCLUDED_PREFIXES.any? { |prefix| dir_name == prefix || dir_name.start_with?("#{prefix}/") }
    end

    def visible_dir?(absolute_path)
      base = File.basename(absolute_path)
      return false if base.start_with?(".")
      return false if excluded?(base)
      true
    end

    def build_children(absolute_dir, relative_dir)
      entries = Dir
        .children(absolute_dir)
        .sort
        .flat_map { |name| build_entry(absolute_dir, relative_dir, name) }
      entries
    end

    def build_entry(absolute_dir, relative_dir, name)
      child_absolute = File.join(absolute_dir, name)
      child_relative = relative_dir.empty? ? name : File.join(relative_dir, name)

      if File.directory?(child_absolute)
        return [] unless visible_dir?(child_absolute)
        depth = child_relative.split("/").length
        return [] if depth > MAX_DEPTH

        node = build_folder_node(child_absolute, child_relative)
        return [] if node.nil?
        [node]
      elsif leaf_file?(child_absolute)
        [build_file_node(child_absolute, child_relative)]
      else
        []
      end
    end

    def build_folder_node(absolute_dir, relative_dir)
      children = build_children(absolute_dir, relative_dir)
      has_readme = readme?(absolute_dir)

      node = {
        "title" => titleize(File.basename(relative_dir)),
        "children" => children
      }

      if has_readme
        node["url"] = "/#{relative_dir}/"
      elsif children.empty?
        return nil
      end

      node
    end

    def build_file_node(absolute_path, relative_path)
      base = File.basename(relative_path)
      ext = File.extname(base).downcase

      if base.downcase.start_with?("readme.")
        return nil
      end

      if ext == ".md" || ext == ".markdown" || ext == ".html"
        url = "/#{relative_path.sub(%r{\A(.*?)(index|readme)?\.(md|markdown|html)\z}i) { "#{$1}/" }}"
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

    def leaf_file?(absolute_path)
      return false if File.directory?(absolute_path)
      return false unless File.file?(absolute_path)
      base = File.basename(absolute_path)
      return false if base.start_with?(".")
      ext = File.extname(base).downcase
      INCLUDED_EXTS.include?(ext)
    end

    def readme?(absolute_dir)
      %w[README.md README.markdown readme.md].any? do |name|
        File.exist?(File.join(absolute_dir, name))
      end
    end

    def meaningful?(node)
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