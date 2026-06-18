export const getCategoryName = (name, t) => {
  if (!name) return name;
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  const keyMap = {
    "thông báo": "announcements",
    "thông báo chung": "generalAnnouncements",
    "chung": "general",
    "đoàn - hội": "unionAssociation",
    "đoàn-hội": "unionAssociation",
    "học tập": "academics",
    "sự kiện": "events",
    "câu lạc bộ": "clubs",
    "góc chia sẻ": "sharingCorner",
    "tán gẫu": "casual",
    "tán gẫu linh tinh": "casual",
    "hỏi đáp": "qa",
    "góp ý": "feedback",
    "ý kiến & đóng góp": "feedback",
    "ý kiến đóng góp": "feedback",
    "thảo luận": "discussion",
    "báo cáo": "reports",
    "phản hồi về diễn đàn": "forumFeedback",
    "phản hồi diễn đàn": "forumFeedback",
    "nội quy": "rules",
    "nội quy diễn đàn": "forumRules",
    "tin tức": "news",
    "giải trí": "entertainment",
    "tài liệu": "documents",
    "tài liệu học tập": "academicDocuments",
    "tâm sự": "confessions",
    "chuyện của trường": "schoolStories",
    "hoạt động ngoại khóa": "extracurricular",
    "hỗ trợ kỹ thuật": "technicalSupport",
    "giải trí - xã hội": "entertainmentSocial",
    "giải trí xã hội": "entertainmentSocial",
    "góc kỹ năng sống": "lifeSkillsCorner",
    "giao lưu": "socialExchange",
    "mua bán và trao đổi": "tradeExchange",
    "mua bán & trao đổi": "tradeExchange",
    "góp ý và báo lỗi": "feedbackBugReport",
    "góp ý & báo lỗi": "feedbackBugReport",
    "tin tức trên quản trị": "adminNews",
    "kỹ năng sống": "lifeSkills",
    "giao lưu kết bạn": "socializing",
    "mua bán": "buySell",
    "báo cáo lỗi": "bugReports",
    "đóng góp ý kiến": "suggestions",
    "tin tức từ ban quản trị": "newsFromAdmin",
    "quy định và hướng dẫn": "regulationsGuidelines",
    "tin tức đoàn": "unionNews",
    "trung học phổ thông": "highSchool",
    "trung học cơ sở": "middleSchool",
    "tiếng anh": "english",
    "ebook - giáo trình": "ebookTextbooks",
    "học ngoại ngữ": "learnLanguages",
    "văn học - nghệ thuật": "literatureArts",
    "âm nhạc": "music",
    "hình ảnh đẹp": "beautifulImages",
    "thư giãn - đố vui": "relaxationPuzzles",
    "thế giới game": "gamingWorld",
    "kiến thức thú vị": "interestingKnowledge",
    "chuyện showbiz": "showbizStories",
    "sự kiện trường tổ chức": "schoolEvents",
    "tình nguyện và cộng đồng": "volunteerCommunity",
    "thể thao và sức khỏe": "sportsHealth",
    "kỹ năng mềm": "softSkills",
    "hướng nghiệp": "careerOrientation",
    "sức khỏe và tâm lý": "healthPsychology",
    "ký túc xá & đời sống học sinh": "dormLife",
    "ký túc xá và đời sống học sinh": "dormLife",
    "kết nối cựu học sinh": "alumniConnection",
    "góc tâm sự": "confessionsCorner",
    "tìm đồ thất lạc": "lostAndFound",
    "mua bán sách cũ": "oldBooksTrade",
    "đồ dùng học tập": "schoolSupplies",
    "trao đổi vật dụng cá nhân": "personalItemsExchange",
    "báo lỗi kỹ thuật": "technicalBugReport"
  };
  const key = keyMap[normalized];
  if (key) {
    const translated = t(`forumCategories.${key}`);
    if (translated !== `forumCategories.${key}`) {
      return translated;
    }
  }
  return name;
};

export const getCategoryDescription = (desc, t) => {
  if (!desc) return desc;
  const normalized = desc.trim().toLowerCase().replace(/\s+/g, " ");
  const descMap = {
    "thông báo từ ban quản trị": "announcementsDesc",
    "thông báo từ ban quản trị.": "announcementsDesc",
    "thông báo từ quản trị viên": "announcementsDesc",
    "thông báo từ ban quản trị trường": "announcementsDesc",
    "nội quy diễn đàn": "rulesDesc",
    "nội quy và hướng dẫn sử dụng diễn đàn": "rulesDesc",
    "nội quy và hướng dẫn sử dụng": "rulesDesc",
    "thảo luận và chia sẻ tài liệu học tập": "academicDesc",
    "chia sẻ tài liệu học tập": "academicDesc",
    "thảo luận học tập": "academicDesc",
    "thảo luận chung các chủ đề": "generalDesc",
    "thảo luận các chủ đề chung": "generalDesc",
    "trò chuyện, tán gẫu linh tinh": "casualDesc",
    "tán gẫu, trò chuyện tự do": "casualDesc",
    "trò chuyện tự do": "casualDesc",
    "đóng góp ý kiến xây dựng diễn đàn": "feedbackDesc",
    "góp ý xây dựng diễn đàn": "feedbackDesc",
    "báo cáo lỗi và góp ý": "feedbackDesc",
    "chia sẻ kinh nghiệm, kỹ năng sống": "lifeSkillsDesc",
    "giao lưu, kết bạn bốn phương": "socialExchangeDesc",
    "mua bán, trao đổi đồ dùng, sách vở": "tradeExchangeDesc",
    "thảo luận, giải trí xã hội": "entertainmentDesc",
    "các thông báo chính thức liên quan đến hoạt động của diễn đàn và cộng đồng cbh youth online.": "newsFromAdminDesc",
    "những bài viết giúp bạn nắm rõ quy định và cách thức tham gia diễn đàn.": "regulationsGuidelinesDesc",
    "cập nhật nhanh chóng, chính xác các hoạt động, phong trào đoàn - trường. nơi lan tỏa những câu chuyện truyền cảm hứng, gương sáng thanh niên và thông tin sự kiện ý nghĩa. đồng hành cùng tuổi trẻ, kết nối và cống hiến!": "unionNewsDesc",
    "là nơi trao đổi kiến thức, kinh nghiệm học tập cho học sinh cấp 3. thảo luận các môn học, chia sẻ bí quyết ôn thi, giải đáp thắc mắc và cùng nhau vượt qua những thử thách trong học tập.": "highSchoolDesc",
    "là không gian dành cho học sinh cấp 2. tại đây, các bạn có thể thảo luận về môn học, chia sẻ kinh nghiệm học tập, đặt câu hỏi và giúp đỡ nhau trong hành trình học tập, từ bài vở đến kỳ thi.": "middleSchoolDesc",
    "là không gian dành cho học sinh yêu thích ngôn ngữ này. tại đây, các bạn có thể thảo luận về ngữ pháp, từ vựng, chia sẻ tài liệu học tập, hỏi đáp và cùng nhau nâng cao kỹ năng tiếng anh của mình.": "englishDesc",
    "là nơi chia sẻ tài liệu học tập, giáo trình và ebook miễn phí. hãy cùng nhau tìm kiếm, trao đổi và phát triển kiến thức qua các nguồn tài liệu phong phú, từ sách giáo khoa đến tài liệu tham khảo.": "ebookTextbooksDesc",
    "chuyên mục dành cho các thành viên yêu thích và muốn học các ngôn ngữ khác nhau như tiếng anh, tiếng nhật, tiếng hàn, tiếng trung, và nhiều ngôn ngữ khác.": "learnLanguagesDesc",
    "không gian dành cho những tâm hồn yêu cái đẹp, nơi giao thoa giữa văn chương và nghệ thuật. cùng khám phá truyện ngắn, thơ ca, hội họa, âm nhạc và những góc nhìn sáng tạo, lan tỏa cảm hứng và đam mê nghệ thuật!": "literatureArtsDesc",
    "là không gian dành cho những ai yêu thích âm nhạc. tại đây, bạn có thể thảo luận về các thể loại nhạc, chia sẻ bài hát yêu thích, cập nhật tin tức về nghệ sĩ và tham gia vào những buổi giao lưu âm nhạc thú vị.": "musicDesc",
    "là nơi chia sẻ những bức ảnh ấn tượng và nghệ thuật. bạn có thể đăng tải hình ảnh yêu thích, thảo luận về các tác phẩm nổi bật và khám phá vẻ đẹp của thế giới xung quanh qua ống kính của những người đam mê nhiếp ảnh.": "beautifulImagesDesc",
    "là không gian thú vị dành cho những ai yêu thích trí tuệ và giải trí. hãy tham gia các câu đố, trò chơi tư duy, thách thức bạn bè và cùng nhau tìm ra đáp án để thư giãn và vui vẻ sau những giờ học tập căng thẳng!": "relaxationPuzzlesDesc",
    "là nơi tập hợp những tín đồ yêu thích trò chơi điện tử. tại đây, bạn có thể thảo luận về game mới, chia sẻ kinh nghiệm, hướng dẫn chơi, cũng as tham gia các sự kiện và giao lưu với cộng đồng game thủ khác.": "gamingWorldDesc",
    "những thông tin độc đáo, bổ ích về khoa học, đời sống, công nghệ và nhiều lĩnh vực khác, giúp bạn mở rộng hiểu biết một cách dễ dàng và hấp dẫn!": "interestingKnowledgeDesc",
    "cập nhật tin tức nóng hổi về làng giải trí, từ hậu trường đến đời tư sao việt và quốc tế. drama, tình yêu, thời trang, sự kiện đình đám – tất cả đều có tại đây!": "showbizStoriesDesc",
    "thông tin về các sự kiện, hội thảo, cuộc thi, hoặc chương trình ngoại khóa sắp tới.": "schoolEventsDesc",
    "đăng ký và tham gia các câu luận bộ, nhóm hoạt động về sở thích chung như âm nhạc, thể thao, nghệ thuật, lập trình, v.v.": "clubsDesc",
    "đăng ký và tham gia các câu lạc bộ, nhóm hoạt động về sở thích chung như âm nhạc, thể thao, nghệ thuật, lập trình, v.v.": "clubsDesc",
    "các hoạt động tình nguyện, hỗ trợ cộng đồng và các dự án giúp đỡ những người xung quanh.": "volunteerCommunityDesc",
    "tham gia các hoạt động thể thao như bóng đá, cầu lông, bóng rổ hoặc các lớp tập thể dục, yoga để rèn luyện sức khỏe.": "sportsHealthDesc",
    "đây là nơi chia sẻ những bài học, tips và phương pháp giúp các thành viên nâng cao khả năng giao tiếp, lãnh đạo, làm việc nhóm, giải quyết vấn đề và nhiều kỹ năng quan trọng khác.": "softSkillsDesc",
    "cung cấp thông tin, lời khuyên và các nguồn tài nguyên về việc chọn ngành nghề, phát triển kỹ năng chuyên môn, tìm kiếm cơ hội việc làm, cũng như chuẩn bị cho sự nghiệp lâu dài.": "careerOrientationDesc",
    "chuyên mục này dành cho việc chia sẻ và học hỏi về các vấn đề sức khỏe thể chất và tinh thần, nhằm giúp các thành viên duy trì cuộc sống lành mạnh, cân bằng và hạnh phúc.": "healthPsychologyDesc",
    "chuyên mục chia sẻ về cuộc sống tại ký túc xá, từ việc sinh hoạt, quản lý thời gian, đến các hoạt động ngoại khóa, giao lưu bạn bè và những mẹo sống độc lập. cùng nhau học hỏi và tạo ra môi trường sống tích cực, tiện nghi!": "dormLifeDesc",
    "chuyên mục dành cho cựu học sinh để kết nối, chia sẻ kinh nghiệm và duy trì mối quan hệ với trường cũ. đây là nơi để tổ chức các sự kiện, giao lưu và hỗ trợ các thế hệ học sinh sau này. cùng nhau giữ vững truyền thống và tạo dựng cộng đồng bền vững!": "alumniConnectionDesc",
    "chuyên mục để các thành viên chia sẻ cảm xúc, câu chuyện cá nhân và những điều trong lòng. đây là không gian an toàn để lắng nghe, thấu hiểu và tìm sự đồng cảm từ cộng đồng. hãy cùng nhau hỗ trợ, sẻ chia và vượt qua khó khăn!": "confessionsCornerDesc",
    "nơi các thành viên đăng tin về đồ dùng bị mất hoặc tìm thấy, giúp kết nối và hỗ trợ lẫn nhau trong việc tìm kiếm.": "lostAndFoundDesc",
    "chuyên mục dành cho những ai muốn mua, bán hoặc trao đổi sách cũ. đây là nơi chia sẻ các đầu sách giá rẻ, còn mới hoặc cần tìm cuốn sách yêu thích. cùng nhau tạo cơ hội để học hỏi và khám phá thế giới tri thức qua sách!": "oldBooksTradeDesc",
    "chuyên mục dành cho việc mua bán, trao đổi hoặc chia sẻ các đồ dùng học tập cũ và mới. từ sách vở, bút, cặp sách đến các dụng cụ học tập khác, đây là nơi giúp các bạn tiết kiệm chi phí và tìm kiếm những món đồ học tập cần thiết!": "schoolSuppliesDesc",
    "chuyên mục dành cho việc mua bán, trao đổi hoặc tặng những vật dụng cá nhân đã qua sử dụng. đây là nơi để bạn tìm kiếm, chia sẻ hoặc đổi những món đồ cần thiết như quần áo, giày dép, phụ kiện, đồ điện tử và nhiều vật dụng khác!": "personalItemsExchangeDesc",
    "chuyên mục dành cho các thành viên chia sẻ ý kiến, đóng góp và phản hồi về diễn đàn. đây là nơi bạn có thể đưa ra các đề xuất cải tiến, báo cáo lỗi hoặc chia sẻ trải nghiệm của mình để giúp cộng đồng ngày càng phát triển tốt hơn!": "forumFeedbackDesc",
    "chuyên mục dành cho các thành viên thông báo về các lỗi kỹ thuật, sự cố hoặc vấn đề gặp phải khi sử dụng diễn đàn. hãy chia sẻ chi tiết về lỗi để đội ngũ quản trị có thể khắc phục và cải thiện hệ thống một cách nhanh chóng!": "technicalBugReportDesc"
  };
  const key = descMap[normalized];
  if (key) {
    const translated = t(`forumCategoryDescriptions.${key}`);
    if (translated !== `forumCategoryDescriptions.${key}`) {
      return translated;
    }
  }
  return desc;
};
